"""Nightly job that emails the global multi-project PDF report.

Designed to fire ~1 hour after the nightly scan cron so every project's
scan + audit + AI analysis has had time to refresh. Before sending we
check for any scan jobs still running; if some are still pending we
flag them in the email body but send anyway, so the report never gets
silently held up by a single slow repo.
"""

import logging

from sqlalchemy import select, func

from apps.api.config import settings
from apps.api.jobs.context import JobContext
from apps.api.models.job import Job
from apps.api.models.product import Product
from apps.api.services.email_service import EmailService
from apps.api.services.project_report_pdf_service import ProjectReportPDFService

logger = logging.getLogger(__name__)


def _parse_recipients(raw: str) -> list[str]:
    return [e.strip() for e in (raw or "").split(",") if e.strip()]


async def nightly_global_report_email(ctx: dict) -> None:
    """Generate the global PDF report and email it to configured recipients."""
    recipients = _parse_recipients(settings.global_report_email_to)
    if not recipients:
        logger.warning(
            "nightly_global_report_email: GLOBAL_REPORT_EMAIL_TO is empty, skipping send",
        )
        return

    jctx = JobContext()
    try:
        session = await jctx.get_session()

        # Soft check: warn if scans are still running so the body can flag it.
        running_stmt = select(func.count()).where(
            Job.job_type == "high_level_scan",
            Job.status.in_(["pending", "running"]),
        )
        running = (await session.execute(running_stmt)).scalar_one() or 0
        warnings: list[str] = []
        if running > 0:
            warnings.append(
                f"{running} scan job(s) were still running when the report was generated — "
                "their data may not be in this PDF.",
            )
            logger.warning(
                "nightly_global_report_email: %d scan(s) still running at send time", running,
            )

        active_count_stmt = select(func.count()).where(
            Product.archived_at.is_(None),
        )
        active_count = (await session.execute(active_count_stmt)).scalar_one() or 0

        pdf_svc = ProjectReportPDFService(session)
        pdf_buf, filename = await pdf_svc.generate_global()
        pdf_bytes = pdf_buf.getvalue()
        logger.info(
            "nightly_global_report_email: generated %s (%d bytes), sending to %s",
            filename, len(pdf_bytes), recipients,
        )

        ok = await EmailService.send_global_report_email(
            to_emails=recipients,
            pdf_bytes=pdf_bytes,
            filename=filename,
            project_count=active_count,
            warnings=warnings or None,
        )
        if ok:
            logger.info("nightly_global_report_email: delivered to Resend")
        else:
            logger.error("nightly_global_report_email: send returned False")
    except Exception as exc:
        logger.exception("nightly_global_report_email crashed: %s", exc)
    finally:
        await jctx.close()
