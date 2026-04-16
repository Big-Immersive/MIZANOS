"""Arq worker settings — registers job functions and Redis config.

Cron schedule (TEST mode):
  - nightly_scan_all_products       runs Mon–Fri at 08:30 UTC = 13:30 PKT
  - nightly_global_report_email     runs Mon–Fri at 10:00 UTC = 15:00 PKT
    (currently bumped to 15:00 PKT for an immediate retry test;
     normal cadence is 1 hour after the scan)

Production schedule will be:
  - scan        13:00 UTC = 18:00 PKT
  - report      14:00 UTC = 19:00 PKT
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
            hour=8,
            minute=30,
            run_at_startup=False,
            unique=True,
        ),
        cron(
            nightly_global_report_email,
            weekday={0, 1, 2, 3, 4},  # Mon..Fri
            hour=10,
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
