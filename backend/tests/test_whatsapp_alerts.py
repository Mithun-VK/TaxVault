"""WhatsApp alert delivery (Twilio) and the settings endpoints behind it.

Twilio is never actually called: `send_whatsapp` is patched, or httpx is
stubbed, so these assert our own behaviour — recipient resolution, the message
body, the configured/unconfigured guards, bulk updates and the RBAC on each
endpoint — without a network round trip or real credentials.
"""
from datetime import date
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.notifications.base import Notification, NotificationChannel
from app.notifications.channels.whatsapp import (
    WhatsAppChannel,
    _to_whatsapp_address,
    resolve_recipient,
)
from app.notifications.templates import build_whatsapp_body
from tests.conftest import auth

TWILIO_ENV = {
    "TWILIO_ACCOUNT_SID": "ACtest",
    "TWILIO_AUTH_TOKEN": "secret",
    "TWILIO_WHATSAPP_FROM": "+14155238886",
    "TWILIO_WHATSAPP_TO": "+919876543210",
}


@pytest.fixture
def twilio_configured(monkeypatch):
    for key, value in TWILIO_ENV.items():
        monkeypatch.setattr(settings, key, value)
    return TWILIO_ENV


@pytest.fixture
def twilio_unconfigured(monkeypatch):
    cleared = [*TWILIO_ENV, "TWILIO_WHATSAPP_TO"]
    for key in cleared:
        monkeypatch.setattr(settings, key, "")
    return cleared


def _notification(**overrides):
    import uuid

    defaults = {
        "user_id": uuid.uuid4(),
        "entity_type": "bill",
        "entity_id": uuid.uuid4(),
        "channel": NotificationChannel.WHATSAPP,
        "subject": "Bill due tomorrow",
        "body": "TNEB is due tomorrow",
        "days_before": 1,
        "metadata": {"phone": "+919999888877"},
    }
    defaults.update(overrides)
    return Notification(**defaults)


class TestAddressNormalisation:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("+919876543210", "whatsapp:+919876543210"),
            ("919876543210", "whatsapp:+919876543210"),
            ("+91 98765 43210", "whatsapp:+919876543210"),
            ("+91-98765-43210", "whatsapp:+919876543210"),
            # Already prefixed — must not be double-prefixed.
            ("whatsapp:+919876543210", "whatsapp:+919876543210"),
            ("", ""),
        ],
    )
    def test_numbers_become_twilio_addresses(self, raw, expected):
        assert _to_whatsapp_address(raw) == expected


class TestRecipientResolution:
    def test_env_number_wins(self, twilio_configured):
        """One household number, whichever account's record fired the alert."""
        assert resolve_recipient("+919999888877") == "+919876543210"

    def test_falls_back_to_the_users_number(self, monkeypatch, twilio_configured):
        monkeypatch.setattr(settings, "TWILIO_WHATSAPP_TO", "")
        assert resolve_recipient("+919999888877") == "+919999888877"

    def test_no_number_anywhere(self, monkeypatch, twilio_configured):
        monkeypatch.setattr(settings, "TWILIO_WHATSAPP_TO", "")
        assert resolve_recipient(None) == ""


class TestMessageBody:
    def test_reads_as_a_reminder(self):
        body = build_whatsapp_body("bill", "TNEB electricity", date(2026, 9, 30), 1850.0, 3)
        assert "*Bill due in 3 days*" in body
        assert "*TNEB electricity*" in body
        # Grouped, no stray decimal — this is read on a phone.
        assert "₹1,850" in body
        assert "30 Sep 2026" in body

    def test_zero_days_reads_as_overdue(self):
        body = build_whatsapp_body("tax", "Property Tax", date(2026, 1, 1), 5000.0, 0)
        assert "overdue" in body.lower()

    def test_missing_amount_and_date_do_not_break_it(self):
        body = build_whatsapp_body("insurance", "LIC", None, None, 1)
        assert "—" in body
        assert "LIC" in body


class TestChannelSend:
    async def test_sends_when_configured(self, twilio_configured):
        with patch(
            "app.notifications.channels.whatsapp.send_whatsapp", new_callable=AsyncMock
        ) as send:
            send.return_value = True
            assert await WhatsAppChannel().send(_notification()) is True
        send.assert_awaited_once()
        # Goes to the household number, not the user's.
        assert send.await_args.args[0] == "+919876543210"

    async def test_refuses_when_not_configured(self, twilio_unconfigured):
        """No credentials means no request — a guaranteed 401 is not worth sending."""
        with patch(
            "app.notifications.channels.whatsapp.send_whatsapp", new_callable=AsyncMock
        ) as send:
            assert await WhatsAppChannel().send(_notification()) is False
        send.assert_not_awaited()

    async def test_refuses_when_there_is_no_recipient(self, monkeypatch, twilio_configured):
        monkeypatch.setattr(settings, "TWILIO_WHATSAPP_TO", "")
        with patch(
            "app.notifications.channels.whatsapp.send_whatsapp", new_callable=AsyncMock
        ) as send:
            assert await WhatsAppChannel().send(_notification(metadata={})) is False
        send.assert_not_awaited()

    async def test_twilio_error_is_a_failed_send_not_an_exception(self, twilio_configured):
        """A bad response must be recorded as a failed alert, never raised into
        the scheduler where it would stop the rest of the run."""
        with patch("app.notifications.channels.whatsapp.httpx.AsyncClient") as client_cls:
            client = client_cls.return_value.__aenter__.return_value
            client.post = AsyncMock(
                return_value=type("R", (), {"status_code": 401, "text": "unauthorised"})()
            )
            assert await WhatsAppChannel().send(_notification()) is False


class TestWhatsAppStatusEndpoint:
    async def test_reports_configured(self, client: AsyncClient, user_a: dict, twilio_configured):
        resp = await client.get("/api/v1/alerts/whatsapp", headers=auth(user_a))
        assert resp.status_code == 200
        data = resp.json()
        assert data["configured"] is True
        assert data["missing"] == []

    async def test_never_returns_the_token(
        self, client: AsyncClient, user_a: dict, twilio_configured
    ):
        resp = await client.get("/api/v1/alerts/whatsapp", headers=auth(user_a))
        assert "secret" not in resp.text
        # The number is masked, so the page can confirm it without exposing it.
        assert "9876543210" not in resp.text
        assert "••••" in resp.json()["recipient"]

    async def test_names_the_missing_settings(
        self, client: AsyncClient, user_a: dict, twilio_unconfigured
    ):
        resp = await client.get("/api/v1/alerts/whatsapp", headers=auth(user_a))
        data = resp.json()
        assert data["configured"] is False
        assert "TWILIO_ACCOUNT_SID" in data["missing"]

    async def test_member_cannot_read_status(
        self, client: AsyncClient, member: dict, twilio_configured
    ):
        """Members are the payables desk and hold no alerts.view — the whole
        alerts surface, delivery settings included, is withheld from them."""
        resp = await client.get("/api/v1/alerts/whatsapp", headers=auth(member))
        assert resp.status_code == 403

    async def test_admin_can_read_status(
        self, client: AsyncClient, user_b: dict, twilio_configured
    ):
        """Admins see everything, so the settings load for them read-only."""
        resp = await client.get("/api/v1/alerts/whatsapp", headers=auth(user_b))
        assert resp.status_code == 200


class TestWhatsAppTestEndpoint:
    async def test_super_admin_can_send(
        self, client: AsyncClient, user_a: dict, twilio_configured
    ):
        with patch(
            "app.services.alert_service.send_whatsapp", new_callable=AsyncMock
        ) as send:
            send.return_value = True
            resp = await client.post("/api/v1/alerts/whatsapp/test", headers=auth(user_a))
        assert resp.status_code == 200
        assert resp.json()["sent"] is True

    async def test_reports_failure_without_raising(
        self, client: AsyncClient, user_a: dict, twilio_configured
    ):
        with patch(
            "app.services.alert_service.send_whatsapp", new_callable=AsyncMock
        ) as send:
            send.return_value = False
            resp = await client.post("/api/v1/alerts/whatsapp/test", headers=auth(user_a))
        assert resp.status_code == 200
        assert resp.json()["sent"] is False

    async def test_unconfigured_explains_itself(
        self, client: AsyncClient, user_a: dict, twilio_unconfigured
    ):
        resp = await client.post("/api/v1/alerts/whatsapp/test", headers=auth(user_a))
        assert resp.json()["sent"] is False
        assert "not configured" in resp.json()["detail"].lower()

    async def test_admin_cannot_send(self, client: AsyncClient, user_b: dict, twilio_configured):
        """Sending is a write — admins read alert settings but do not change them."""
        resp = await client.post("/api/v1/alerts/whatsapp/test", headers=auth(user_b))
        assert resp.status_code == 403

    async def test_member_cannot_send(self, client: AsyncClient, member: dict, twilio_configured):
        resp = await client.post("/api/v1/alerts/whatsapp/test", headers=auth(member))
        assert resp.status_code == 403


class TestBulkUpdate:
    async def test_applies_to_every_rule(self, client: AsyncClient, user_a: dict):
        for payload in (
            {"tax_type": "property_tax", "due_date": "2026-09-30", "total_amount": "500.00"},
            {"tax_type": "water_tax", "due_date": "2026-10-30", "total_amount": "600.00"},
        ):
            await client.post("/api/v1/taxes/", headers=auth(user_a), json=payload)

        resp = await client.patch(
            "/api/v1/alerts/configs",
            headers=auth(user_a),
            json={"days_before": [7, 1], "channels": ["whatsapp"]},
        )
        assert resp.status_code == 200
        assert resp.json()["updated"] == 2

        configs = await client.get("/api/v1/alerts/configs", headers=auth(user_a))
        for c in configs.json()["items"]:
            assert c["days_before"] == [7, 1]
            assert c["channels"] == ["whatsapp"]

    async def test_can_narrow_to_one_entity_type(self, client: AsyncClient, user_a: dict):
        await client.post(
            "/api/v1/taxes/",
            headers=auth(user_a),
            json={"tax_type": "property_tax", "due_date": "2026-09-30", "total_amount": "500.00"},
        )
        await client.post(
            "/api/v1/bills/",
            headers=auth(user_a),
            json={
                "bill_type": "electricity",
                "provider_name": "TNEB",
                "billing_cycle": "monthly",
                "average_amount": "800.00",
                "next_due_date": "2026-07-10",
            },
        )

        resp = await client.patch(
            "/api/v1/alerts/configs",
            headers=auth(user_a),
            json={"entity_type": "bill", "is_active": False},
        )
        assert resp.json()["updated"] == 1

        configs = await client.get("/api/v1/alerts/configs", headers=auth(user_a))
        by_type = {c["entity_type"]: c["is_active"] for c in configs.json()["items"]}
        assert by_type["bill"] is False
        assert by_type["tax"] is True

    async def test_empty_payload_changes_nothing(
        self, client: AsyncClient, user_a: dict, tax: dict
    ):
        resp = await client.patch("/api/v1/alerts/configs", headers=auth(user_a), json={})
        assert resp.json()["updated"] == 0

    async def test_admin_cannot_bulk_update(self, client: AsyncClient, user_b: dict):
        resp = await client.patch(
            "/api/v1/alerts/configs", headers=auth(user_b), json={"is_active": False}
        )
        assert resp.status_code == 403

    async def test_member_cannot_bulk_update(self, client: AsyncClient, member: dict):
        resp = await client.patch(
            "/api/v1/alerts/configs", headers=auth(member), json={"is_active": False}
        )
        assert resp.status_code == 403


class TestNewConfigDefaults:
    async def test_a_new_payable_alerts_over_whatsapp(self, client: AsyncClient, user_a: dict):
        """The default has to be a channel the deployment can actually send on."""
        await client.post(
            "/api/v1/taxes/",
            headers=auth(user_a),
            json={"tax_type": "property_tax", "due_date": "2026-09-30", "total_amount": "500.00"},
        )
        configs = await client.get("/api/v1/alerts/configs", headers=auth(user_a))
        assert configs.json()["items"][0]["channels"] == ["whatsapp"]
