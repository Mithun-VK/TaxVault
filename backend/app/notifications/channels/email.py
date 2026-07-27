import logging
import os

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from jinja2 import Environment, FileSystemLoader

from app.core.config import settings
from app.notifications.base import BaseChannel, Notification

logger = logging.getLogger(__name__)

_template_dir = os.path.join(os.path.dirname(__file__), "../../../templates/email")
_env = Environment(loader=FileSystemLoader(_template_dir), autoescape=True)

# Reuse a single SES client across sends (boto3 clients are thread-safe).
_ses_client = None


def _get_ses_client():  # type: ignore[no-untyped-def]
    global _ses_client
    if _ses_client is None:
        _ses_client = boto3.client(
            "ses",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
    return _ses_client


class EmailChannel(BaseChannel):
    async def send(self, notification: Notification) -> bool:
        try:
            client = _get_ses_client()
            body: dict = {"Text": {"Data": notification.body, "Charset": "UTF-8"}}
            if notification.html_body:
                body["Html"] = {"Data": notification.html_body, "Charset": "UTF-8"}

            client.send_email(
                Source=settings.EMAIL_FROM,
                Destination={"ToAddresses": [notification.metadata.get("email", "")]},
                Message={
                    "Subject": {"Data": notification.subject, "Charset": "UTF-8"},
                    "Body": body,
                },
            )
            return True
        except (BotoCoreError, ClientError) as exc:
            logger.error("SES send failed: %s", exc)
            return False
