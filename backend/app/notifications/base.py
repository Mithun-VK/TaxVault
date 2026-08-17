import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class NotificationChannel(str, Enum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"


@dataclass
class Notification:
    user_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    channel: NotificationChannel
    subject: str
    body: str
    html_body: str = ""
    days_before: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseChannel(ABC):
    @abstractmethod
    async def send(self, notification: Notification) -> bool: ...
