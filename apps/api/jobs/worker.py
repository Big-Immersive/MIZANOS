"""Arq worker settings — registers job functions and Redis config.

Cron schedule (production):
  - nightly_scan_all_products       runs Mon–Fri at 15:00 UTC = 20:00 PKT
  - nightly_global_report_email     runs Mon–Fri at 16:00 UTC = 21:00 PKT
    (1 hour after the scan so every project's scan + AI analysis has
     time to finish before the PDF is generated)
"""

from arq.cron import cron

from apps.api.jobs.ai_analysis_job import ai_analysis_job
from apps.api.jobs.global_report_email_job import nightly_global_report_email
from apps.api.jobs.nightly_cron import nightly_scan_all_products
from apps.api.jobs.scan_job import high_level_scan_job
from packages.common.redis.client import parse_redis_settings


class WorkerSettings:
    """Arq worker configuration."""

    functions = [
        high_level_scan_job,
        ai_analysis_job,
        nightly_scan_all_products,
        nightly_global_report_email,
    ]
    cron_jobs = [
        cron(
            nightly_scan_all_products,
            weekday={0, 1, 2, 3, 4},  # Mon..Fri
            hour=15,
            minute=0,
            run_at_startup=False,
            unique=True,
        ),
        cron(
            nightly_global_report_email,
            weekday={0, 1, 2, 3, 4},  # Mon..Fri
            hour=16,
            minute=0,
            run_at_startup=False,
            unique=True,
        ),
    ]
    redis_settings = parse_redis_settings()
    max_jobs = 5
    job_timeout = 900  # 15 minutes
    max_tries = 2
    health_check_interval = 30
