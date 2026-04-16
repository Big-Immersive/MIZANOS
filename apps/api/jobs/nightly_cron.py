"""Nightly scheduled scans — runs at 18:00 PKT (13:00 UTC) Mon–Fri.

Enumerates every non-archived product with a linked repository and an
active GitHub PAT, and enqueues one high_level_scan_job per product via
the same path the Run Scan button uses. Concurrency is bounded by the
worker's max_jobs setting, not here — the cron itself only enqueues.

AI analysis is not triggered from this cron: every scan job chains its
own ai_analysis_job on successful completion (see scan_job.py), so each
project's analysis refreshes the moment its own scan finishes.
"""

import logging

from sqlalchemy import select

from apps.api.jobs.context import JobContext
from apps.api.models.github_pat import GitHubPat
from apps.api.models.product import Product
from apps.api.services.scan_service import ScanService

logger = logging.getLogger(__name__)

CRON_USER_ID = "cron:nightly-scan"


async def nightly_scan_all_products(ctx: dict) -> None:
    """Trigger scans for every eligible active linked project."""
    jctx = JobContext()
    queued = 0
    skipped = 0
    try:
        session = await jctx.get_session()
        stmt = (
            select(Product, GitHubPat)
            .join(GitHubPat, GitHubPat.id == Product.github_pat_id)
            .where(
                Product.archived_at.is_(None),
                Product.repository_url.isnot(None),
                GitHubPat.is_active.is_(True),
            )
        )
        result = await session.execute(stmt)
        rows = list(result.all())
        logger.info("nightly_scan_all_products: found %d candidate products", len(rows))

        scan_svc = ScanService(session)
        for product, _pat in rows:
            try:
                await scan_svc.trigger_high_level_scan(product.id, CRON_USER_ID)
                await session.commit()
                queued += 1
            except Exception as exc:
                await session.rollback()
                # "already in progress" lands here too — that's expected,
                # just means a manual scan is running; skip without noise.
                msg = str(exc)
                if "already in progress" in msg.lower():
                    logger.info("nightly_scan: %s skipped (scan already running)", product.id)
                else:
                    logger.warning("nightly_scan: %s failed to enqueue — %s", product.id, msg)
                skipped += 1
        logger.info(
            "nightly_scan_all_products: queued=%d, skipped=%d, total=%d",
            queued, skipped, len(products),
        )
    except Exception as exc:
        logger.exception("nightly_scan_all_products crashed: %s", exc)
    finally:
        await jctx.close()
