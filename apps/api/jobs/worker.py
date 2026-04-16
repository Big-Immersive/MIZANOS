"""Arq worker settings — registers job functions and Redis config.

Cron schedule (TEST mode):
  nightly_scan_all_products currently runs Mon–Fri at 08:30 UTC,
  which equals 13:30 Asia/Karachi (PKT). Change to hour=13 minute=0
  (18:00 PKT) when moving to the real schedule.
"""

from arq.cron import cron

from apps.api.jobs.ai_analysis_job import ai_analysis_job
from apps.api.jobs.nightly_cron import nightly_scan_all_products
from apps.api.jobs.scan_job import high_level_scan_job
from packages.common.redis.client import parse_redis_settings


class WorkerSettings:
    """Arq worker configuration."""

    functions = [high_level_scan_job, ai_analysis_job, nightly_scan_all_products]
    cron_jobs = [
        cron(
            nightly_scan_all_products,
            weekday={0, 1, 2, 3, 4},  # Mon..Fri
            hour=8,
            minute=30,
            run_at_startup=False,
            unique=True,
        ),
    ]
    redis_settings = parse_redis_settings()
    max_jobs = 5
    job_timeout = 900  # 15 minutes
    max_tries = 2
    health_check_interval = 30
