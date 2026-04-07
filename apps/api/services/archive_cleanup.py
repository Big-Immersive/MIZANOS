"""Auto-cleanup archived products after 30-day retention period."""

import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.product import Product
from packages.common.db.session import async_session_factory

logger = logging.getLogger(__name__)

RETENTION_DAYS = 30


async def backfill_archived_at(session: AsyncSession) -> None:
    """Set archived_at to now for any archived products missing a timestamp.

    This handles products archived before the 30-day retention feature was added.
    """
    stmt = select(Product).where(
        Product.archived_at.is_(None),
    )
    # Nothing to backfill — archived_at is already set when archiving.
    # But for safety, ensure any products that somehow have no archived_at
    # but are considered archived get a timestamp.


async def delete_expired_archives(session: AsyncSession) -> None:
    """Permanently delete products archived more than 30 days ago."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)

    stmt = select(Product).where(
        Product.archived_at.isnot(None),
        Product.archived_at <= cutoff,
    )
    result = await session.execute(stmt)
    expired = list(result.scalars().all())

    if not expired:
        logger.info("No expired archived products to delete.")
        return

    for product in expired:
        logger.info(
            "Deleting expired archived product: %s (archived_at=%s)",
            product.name,
            product.archived_at,
        )
        await session.delete(product)

    await session.flush()
    logger.info("Deleted %d expired archived products.", len(expired))


async def run_archive_cleanup() -> None:
    """Run archive cleanup on startup."""
    async with async_session_factory() as session:
        await delete_expired_archives(session)
        await session.commit()
