"""WhatsApp alert delivery (Twilio) and the alert-settings endpoints.

The channel is exercised against a stubbed Twilio so the tests assert what we
actually send — recipient resolution, the `whatsapp:` addressing Twilio
requires, and that a non-2xx is reported as a failure rather than swallowed.
No test ever reaches the network.
"""
import uuid as uuid_mod
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


@pytest.fixture
def twilio_env(monkeypatch) -> dict[str, str]:
    """A fully configured Twilio, sending to a fixed household number.

    Returns the values it applied so a test can assert against them rather than
    repeating the literals.
    """
    values = {
        "TWILIO_ACCOUNT_SID": "AC_test_sid",
        "TWILIO_AUTH_TOKEN": "test_token",
        "TWILIO_WHATSAPP_FROM": "+14155238886",
        "TWILIO_WHATSAPP_TO": "+919876543210",
    }
    for key, value in values.items():
        monkeypatch.setattr(settings, key, value)
    return values


def _notification(body: str = "Bill due tomorrow", phone: str | None = None) -> Notification:
    return Notification(
        user_id=uuid_mod.uuid4(),
        entity_type="bill",
        entity_id=uuid_mod.uuid4(),
        channel=NotificationChannel.WHATSAPP,
        subject="Bill due",
        body=body,
        metadata={"phone": phone or ""},
    )


class TestAddressing:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("+919876543210", "whatsapp:+919876543210"),
            ("919876543210", "whatsapp:+919876543210"),
            ("+91 98765 43210", "whatsapp:+919876543210"),
            ("+91-98765-43210", "whatsapp:+919876543210"),
            # Already addressed — must not be double-prefixed.
            ("whatsapp:+919876543210", "whatsapp:+919876543210"),
            ("", ""),
        ],
    )
    def test_numbers_are_normalised_for_twilio(self, raw, expected):
        assert _to_whatsapp_address(raw) == expected


class TestRecipientResolution:
    def test_env_number_wins(self, twilio_env):
        assert resolve_recipient("+911111111111") == "+919876543210"

    def test_falls_back_to_the_users_number(self, twilio_env, monkeypatch):
        monkeypatch.setattr(settings, "TWILIO_WHATSAPP_TO", "")
        assert resolve_recipient("+911111111111") == "+911111111111"

    def test_no_number_anywhere(self, twilio_env, monkeypatch):
        monkeypatch.setattr(settings, "TWILIO_WHATSAPP_TO", "")
        assert resolve_recipient(None) == ""


class TestSending:
    async def test_sends_to_twilio_with_the_expected_payload(self, twilio_env):
        with patch("app.notifications.channels.whatsapp.httpx.AsyncClient") as mock_client:
            post = AsyncMock(return_value=type("R", (), {"status_code": 201, "text": "{}"})())
            mock_client.return_value.__aenter__.return_value.post = post

            ok = await WhatsAppChannel().send(_notification("Property tax due tomorrow"))

        assert ok is True
        _, kwargs = post.call_args
        assert kwargs["data"]["From"] == "whatsapp:+14155238886"
        assert kwargs["data"]["To"] == "whatsapp:+919876543210"
        assert kwargs["data"]["Body"] == "Property tax due tomorrow"
        assert kwargs["auth"] == ("AC_test_sid", "test_token")

    async def test_a_twilio_error_is_a_failed_send_not_an_exception(self, twilio_env):
        """A bad send must land in the alert log as failed, never break the run."""
        with patch("app.notifications.channels.whatsapp.httpx.AsyncClient") as mock_client:
            resp = type("R", (), {"status_code": 401, "text": '{"message":"bad auth"}'})()
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=resp)

            assert await WhatsAppChannel().send(_notification()) is False

    async def test_network_error_is_swallowed(self, twilio_env):
        with patch("app.notifications.channels.whatsapp.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                side_effect=OSError("connection reset")
            )
            assert await WhatsAppChannel().send(_notification()) is False

    async def test_unconfigured_twilio_never_calls_out(self, monkeypatch):
        monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "")
        with patch("app.notifications.channels.whatsapp.httpx.AsyncClient") as mock_client:
            assert await WhatsAppChannel().send(_notification()) is False
            mock_client.assert_not_called()

    async def test_no_recipient_never_calls_out(self, twilio_env, monkeypatch):
        monkeypatch.setattr(settings, "TWILIO_WHATSAPP_TO", "")
        with patch("app.notifications.channels.whatsapp.httpx.AsyncClient") as mock_client:
            assert await WhatsAppChannel().send(_notification(phone=None)) is False
            mock_client.assert_not_called()


class TestMessageBody:
    def test_reads_as_a_reminder(self):
        body = build_whatsapp_body("bill", "TNEB electricity", date(2026, 9, 30), 1450.0, 1)
        assert "*Bill due tomorrow*" in body
        assert "*TNEB electricity*" in body
        assert "₹1,450" in body
        assert "30 Sep 2026" in body

    def test_overdue_reads_as_overdue(self):
        body = build_whatsapp_body("tax", "Property tax", date(2026, 1, 1), 5000.0, 0)
        assert "overdue" in body.lower()

    def test_missing_amount_does_not_print_none(self):
        body = build_whatsapp_body("bill", "Water", None, None, 3)
        assert "None" not in body
        assert "—" in body


class TestWhatsAppStatusEndpoint:
    async def test_reports_configured_with_a_masked_number(
        self, client: AsyncClient, user_a: dict, twilio_env
    ):
        resp = await client.get("/api/v1/alerts/whatsapp", headers=auth(user_a))
        assert resp.status_code == 200
        data = resp.json()
        assert data["configured"] is True
        assert data["missing"] == []
        # Masked, and never the raw number.
        assert data["recipient"] == "+91••••3210"
        assert "9876543210" not in str(data)

    async def test_reports_what_is_missing_when_unconfigured(
        self, client: AsyncClient, user_a: dict, monkeypatch
    ):
        monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "")
        monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "")
        monkeypatch.setattr(settings, "TWILIO_WHATSAPP_FROM", "")

        resp = await client.get("/api/v1/alerts/whatsapp", headers=auth(user_a))
        assert resp.json()["configured"] is False
        assert "TWILIO_ACCOUNT_SID" in resp.json()["missing"]

    async def test_never_returns_the_auth_token(
        self, client: AsyncClient, user_a: dict, twilio_env
    ):
        resp = await client.get("/api/v1/alerts/whatsapp", headers=auth(user_a))
        assert "test_token" not in resp.text

    async def test_members_cannot_read_the_status(
        self, client: AsyncClient, member: dict, twilio_env
    ):
        """alerts.view is not a member permission — the payables desk has no
        business seeing the delivery setup."""
        resp = await client.get("/api/v1/alerts/whatsapp", headers=auth(member))
        assert resp.status_code == 403


class TestWhatsAppTestEndpoint:
    async def test_super_admin_can_send_a_test(
        self, client: AsyncClient, user_a: dict, twilio_env
    ):
        with patch("app.notifications.channels.whatsapp.httpx.AsyncClient") as mock_client:
            resp201 = type("R", (), {"status_code": 201, "text": "{}"})()
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=resp201)

            resp = await client.post("/api/v1/alerts/whatsapp/test", headers=auth(user_a))

        assert resp.status_code == 200
        assert resp.json()["sent"] is True

    async def test_unconfigured_returns_a_reason_not_an_error(
        self, client: AsyncClient, user_a: dict, monkeypatch
    ):
        monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "")
        resp = await client.post("/api/v1/alerts/whatsapp/test", headers=auth(user_a))
        assert resp.status_code == 200
        assert resp.json()["sent"] is False
        assert "not configured" in resp.json()["detail"].lower()

    async def test_admin_cannot_send_a_test(self, client: AsyncClient, user_b: dict, twilio_env):
        """Sending is an alerts.edit action — super admin only."""
        resp = await client.post("/api/v1/alerts/whatsapp/test", headers=auth(user_b))
        assert resp.status_code == 403


class TestBulkUpdate:
    async def _seed_two_configs(self, client: AsyncClient, user: dict) -> None:
        await client.post(
            "/api/v1/taxes/",
            headers=auth(user),
            json={"tax_type": "property_tax", "due_date": "2026-09-30", "total_amount": "5000.00"},
        )
        await client.post(
            "/api/v1/bills/",
            headers=auth(user),
            json={
                "bill_type": "electricity",
                "provider_name": "TNEB",
                "billing_cycle": "monthly",
                "average_amount": "800.00",
                "next_due_date": "2026-07-10",
            },
        )

    async def test_applies_to_every_rule_at_once(self, client: AsyncClient, user_a: dict):
        await self._seed_two_configs(client, user_a)

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
        await self._seed_two_configs(client, user_a)

        resp = await client.patch(
            "/api/v1/alerts/configs",
            headers=auth(user_a),
            json={"entity_type": "bill", "is_active": False},
        )
        assert resp.json()["updated"] == 1

        configs = await client.get("/api/v1/alerts/configs", headers=auth(user_a))
        by_type = {c["entity_type"]: c for c in configs.json()["items"]}
        assert by_type["bill"]["is_active"] is False
        assert by_type["tax"]["is_active"] is True

    async def test_empty_payload_changes_nothing(self, client: AsyncClient, user_a: dict):
        await self._seed_two_configs(client, user_a)
        resp = await client.patch("/api/v1/alerts/configs", headers=auth(user_a), json={})
        assert resp.json()["updated"] == 0

    async def test_admin_cannot_bulk_update(self, client: AsyncClient, user_b: dict):
        resp = await client.patch(
            "/api/v1/alerts/configs", headers=auth(user_b), json={"is_active": False}
        )
        assert resp.status_code == 403

    async def test_bulk_route_does_not_shadow_the_single_config_route(
        self, client: AsyncClient, user_a: dict
    ):
        """`/configs` and `/configs/{id}` must both still resolve."""
        await self._seed_two_configs(client, user_a)
        configs = await client.get("/api/v1/alerts/configs", headers=auth(user_a))
        one = configs.json()["items"][0]

        resp = await client.patch(
            f"/api/v1/alerts/configs/{one['id']}",
            headers=auth(user_a),
            json={"is_active": False},
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False


class TestDefaultChannel:
    async def test_new_rules_default_to_whatsapp(self, client: AsyncClient, user_a: dict):
        """A fresh payable must be reachable without any extra setup."""
        await client.post(
            "/api/v1/taxes/",
            headers=auth(user_a),
            json={"tax_type": "property_tax", "due_date": "2026-09-30", "total_amount": "5000.00"},
        )
        configs = await client.get("/api/v1/alerts/configs", headers=auth(user_a))
        assert configs.json()["items"][0]["channels"] == ["whatsapp"]
