"""Arq job that refreshes the AI analysis for a single product.

Enqueued automatically at the end of a successful high_level_scan_job so
the cached AI analysis always reads the scan + audit rows that were just
written. Also safe to enqueue manually from the Generate button path.
"""

import logging
from uuid import UUID

from apps.api.jobs.context import JobContext
from apps.api.services.report_ai_service import ReportAIService

logger = logging.getLogger(__name__)


async def ai_analysis_job(ctx: dict, product_id_str: str) -> None:
    """Generate and cache an AI analysis for one product."""
    try:
        product_id = UUID(product_id_str)
    except ValueError:
        logger.error("ai_analysis_job: invalid product_id %s", product_id_str)
        return

    jctx = JobContext()
    try:
        session = await jctx.get_session()
        svc = ReportAIService(session)
        await svc.generate_analysis(product_id)
        logger.info("ai_analysis_job: refreshed analysis for %s", product_id)
    except Exception as exc:
        logger.exception("ai_analysis_job failed for %s: %s", product_id_str, exc)
    finally:
        await jctx.close()
