from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "taxvault",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.scheduler", "app.tasks.dispatcher"],
)

celery_app.conf.update(
    # Serialization — JSON only (no pickle deserialization risk)
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # Timezone
    timezone="Asia/Kolkata",
    enable_utc=True,
    # Reliability
    task_acks_late=True,  # ack only after the task completes
    task_reject_on_worker_lost=True,  # re-queue if the worker crashes mid-task
    worker_prefetch_multiplier=1,  # one task at a time — safe for long tasks
    task_track_started=True,
    # Don't keep results forever
    result_expires=60 * 60 * 24,  # 24 hours
    # Time limits (soft raises an exception; hard kills the worker process)
    task_soft_time_limit=120,
    task_time_limit=180,
    # Concurrency
    worker_concurrency=4,
    # Beat schedule
    beat_schedule={
        "daily-alert-scan": {
            "task": "app.tasks.scheduler.run_daily_scan",
            "schedule": crontab(hour=8, minute=0),
            "options": {"expires": 60 * 60},
        },
        "overdue-check": {
            "task": "app.tasks.scheduler.check_overdue",
            "schedule": crontab(hour=9, minute=0),
            "options": {"expires": 60 * 60},
        },
    },
    # Logging formats
    worker_log_format="[%(asctime)s: %(levelname)s/%(processName)s] %(message)s",
    worker_task_log_format=(
        "[%(asctime)s: %(levelname)s/%(processName)s]" "[%(task_name)s(%(task_id)s)] %(message)s"
    ),
)
