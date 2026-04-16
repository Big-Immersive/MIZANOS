"""Nightly scheduled scans — runs Mon–Fri at 13:30 PKT (08:30 UTC) in TEST mode.

Enumerates every non-archived product with a linked repository and an
active GitHub PAT, and enqueues one high_level_scan_job per product via
the same path the Run Scan button uses. Concurrency is bounded by the
worker's max_jobs setting, not here — the cron itself only enqueues.

Each project gets its OWN fresh DB session, so a failure on one product
(repo not found, PAT denied, etc.) cannot poison the session and break
the rest of the loop.

AI analysis is not triggered from this cron: every scan job chains its
own ai_analysis_job on successful completion (see scan_job.py), so each
project's analysis refreshes the moment its own scan finishes.
"""

import logging
from uuid import UUID

from sqlalchemy import select

from apps.api.models.github_pat import GitHubPat
from apps.api.models.product import Product
from apps.api.services.scan_service import ScanService
from packages.common.db.session import async_session_factory

logger = logging.getLogger(__name__)

CRON_USER_ID = "cron:nightly-scan"


async def _list_eligible_product_ids() -> list[UUID]:
    """One short-lived session: fetch all product IDs we should scan."""
    async with async_session_factory() as session:
        stmt = (
            select(Product.id)
            .join(GitHubPat, GitHubPat.id == Product.github_pat_id)
            .where(
                Product.archived_at.is_(None),
                Product.repository_url.isnot(None),
                GitHubPat.is_active.is_(True),
            )
        )
        result = await session.execute(stmt)
        return [row[0] for row in result.all()]


async def _enqueue_one(product_id: UUID) -> tuple[bool, str | None]:
    """Trigger a scan for one product in its own isolated session.

    Returns (queued, skip_reason). On success: (True, None). On expected
    skip (already running): (False, "running"). On unexpected failure:
    (False, error_message).
    """
    async with async_session_factory() as session:
        try:
            await ScanService(session).trigger_high_level_scan(product_id, CRON_USER_ID)
            await session.commit()
            return True, None
        except Exception as exc:
            try:
                await session.rollback()
            except Exception:
                pass
            msg = str(exc)
            if "already in progress" in msg.lower():
                return False, "running"
            return False, msg


async def nightly_scan_all_products(ctx: dict) -> None:
    """Trigger scans for every eligible active linked project."""
    try:
        product_ids = await _list_eligible_product_ids()
    except Exception as exc:
        logger.exception("nightly_scan_all_products: failed to list products: %s", exc)
        return

    total = len(product_ids)
    logger.info("nightly_scan_all_products: found %d candidate product(s)", total)

    queued = 0
    skipped_running = 0
    failed = 0
    for product_id in product_ids:
        try:
            ok, reason = await _enqueue_one(product_id)
        except Exception as exc:
            logger.warning("nightly_scan: %s outer failure — %s", product_id, exc)
            failed += 1
            continue
        if ok:
            queued += 1
        elif reason == "running":
            logger.info("nightly_scan: %s skipped (scan already running)", product_id)
            skipped_running += 1
        else:
            logger.warning("nightly_scan: %s failed to enqueue — %s", product_id, reason)
            failed += 1

    logger.info(
        "nightly_scan_all_products: queued=%d, skipped_running=%d, failed=%d, total=%d",
        queued, skipped_running, failed, total,
    )
