"""
Alert configuration and log tests.

AlertConfig is auto-created when tax/bill/insurance is created.
GET  /alerts/configs          → paginated list
GET  /alerts/configs/{id}     → single config
PATCH /alerts/configs/{id}    → update days_before / channels / is_active
GET  /alerts/logs             → paginated list (empty initially)

AlertChannel: email | sms | push
"""
import uuid

from httpx import AsyncClient

from tests.conftest import assert_paginated, auth


async def _get_first_config(client: AsyncClient, user: dict) -> dict:
    """Create a tax (which auto-creates a config) and return the config."""
    await client.post(
        "/api/v1/taxes/",
        headers=auth(user),
        json={
            "tax_type": "property_tax",
            "due_date": "2026-09-30",
            "total_amount": "5000.00",
        },
    )
    configs = await client.get("/api/v1/alerts/configs", headers=auth(user))
    assert configs.json()["total"] >= 1
    return configs.json()["items"][0]


class TestListAlertConfigs:
    async def test_empty_initially(self, client: AsyncClient, user_a: dict):
        resp = await client.get("/api/v1/alerts/configs", headers=auth(user_a))
        assert resp.status_code == 200
        assert_paginated(resp.json(), min_items=0)
        assert resp.json()["total"] == 0

    async def test_config_created_with_tax(self, client: AsyncClient, user_a: dict):
        await client.post(
            "/api/v1/taxes/",
            headers=auth(user_a),
            json={"tax_type": "property_tax", "due_date": "2026-09-30", "total_amount": "5000.00"},
        )
        resp = await client.get("/api/v1/alerts/configs", headers=auth(user_a))
        assert resp.json()["total"] >= 1

    async def test_config_created_with_bill(self, client: AsyncClient, user_a: dict):
        await client.post(
            "/api/v1/bills/",
            headers=auth(user_a),
            json={
                "bill_type": "electricity",
                "billing_cycle": "monthly",
                "next_due_date": "2026-07-10",
            },
        )
        resp = await client.get("/api/v1/alerts/configs", headers=auth(user_a))
        assert resp.json()["total"] >= 1

    async def test_config_created_with_insurance(self, client: AsyncClient, user_a: dict):
        await client.post(
            "/api/v1/insurance/",
            headers=auth(user_a),
            json={
                "policy_number": "ALRT-001",
                "provider_name": "LIC",
                "insurance_type": "life",
                "premium_amount": "12000.00",
                "premium_frequency": "annual",
            },
        )
        resp = await client.get("/api/v1/alerts/configs", headers=auth(user_a))
        assert resp.json()["total"] >= 1

    async def test_filter_by_entity_type_tax(self, client: AsyncClient, user_a: dict):
        await client.post(
            "/api/v1/taxes/",
            headers=auth(user_a),
            json={"tax_type": "property_tax", "due_date": "2026-09-30", "total_amount": "100.00"},
        )
        resp = await client.get(
            "/api/v1/alerts/configs?entity_type=tax", headers=auth(user_a)
        )
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["entity_type"] == "tax"

    async def test_isolation(
        self, client: AsyncClient, user_a: dict, user_b: dict, tax: dict
    ):
        """user_b sees 0 configs even after user_a creates a tax."""
        resp = await client.get("/api/v1/alerts/configs", headers=auth(user_b))
        assert resp.json()["total"] == 0

    async def test_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/alerts/configs")
        assert resp.status_code in (401, 403)


class TestGetAlertConfig:
    async def test_success(self, client: AsyncClient, user_a: dict):
        config = await _get_first_config(client, user_a)
        resp = await client.get(
            f"/api/v1/alerts/configs/{config['id']}", headers=auth(user_a)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == config["id"]
        assert "days_before" in data
        assert "channels" in data
        assert "is_active" in data

    async def test_nonexistent_returns_404(self, client: AsyncClient, user_a: dict):
        resp = await client.get(
            f"/api/v1/alerts/configs/{uuid.uuid4()}", headers=auth(user_a)
        )
        assert resp.status_code == 404

    async def test_idor_returns_404(
        self, client: AsyncClient, user_a: dict, user_b: dict
    ):
        config = await _get_first_config(client, user_a)
        resp = await client.get(
            f"/api/v1/alerts/configs/{config['id']}", headers=auth(user_b)
        )
        assert resp.status_code == 404

    async def test_invalid_uuid_returns_422(self, client: AsyncClient, user_a: dict):
        resp = await client.get("/api/v1/alerts/configs/not-a-uuid", headers=auth(user_a))
        assert resp.status_code == 422


class TestUpdateAlertConfig:
    async def test_update_days_before(self, client: AsyncClient, user_a: dict):
        config = await _get_first_config(client, user_a)
        resp = await client.patch(
            f"/api/v1/alerts/configs/{config['id']}",
            headers=auth(user_a),
            json={"days_before": [7, 3, 1]},
        )
        assert resp.status_code == 200
        assert resp.json()["days_before"] == [7, 3, 1]

    async def test_update_channels(self, client: AsyncClient, user_a: dict):
        config = await _get_first_config(client, user_a)
        resp = await client.patch(
            f"/api/v1/alerts/configs/{config['id']}",
            headers=auth(user_a),
            json={"channels": ["email", "sms"]},
        )
        assert resp.status_code == 200
        channels = resp.json()["channels"]
        assert "email" in channels
        assert "sms" in channels

    async def test_deactivate_config(self, client: AsyncClient, user_a: dict):
        config = await _get_first_config(client, user_a)
        resp = await client.patch(
            f"/api/v1/alerts/configs/{config['id']}",
            headers=auth(user_a),
            json={"is_active": False},
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    async def test_reactivate_config(self, client: AsyncClient, user_a: dict):
        config = await _get_first_config(client, user_a)
        # Deactivate first
        await client.patch(
            f"/api/v1/alerts/configs/{config['id']}",
            headers=auth(user_a),
            json={"is_active": False},
        )
        # Re-activate
        resp = await client.patch(
            f"/api/v1/alerts/configs/{config['id']}",
            headers=auth(user_a),
            json={"is_active": True},
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True

    async def test_invalid_channel_returns_422(self, client: AsyncClient, user_a: dict):
        config = await _get_first_config(client, user_a)
        resp = await client.patch(
            f"/api/v1/alerts/configs/{config['id']}",
            headers=auth(user_a),
            json={"channels": ["pigeon_mail"]},
        )
        assert resp.status_code == 422

    async def test_idor_update_returns_404(
        self, client: AsyncClient, user_a: dict, user_b: dict
    ):
        config = await _get_first_config(client, user_a)
        resp = await client.patch(
            f"/api/v1/alerts/configs/{config['id']}",
            headers=auth(user_b),
            json={"is_active": False},
        )
        assert resp.status_code == 404


class TestListAlertLogs:
    async def test_empty_initially(self, client: AsyncClient, user_a: dict):
        resp = await client.get("/api/v1/alerts/logs", headers=auth(user_a))
        assert resp.status_code == 200
        assert_paginated(resp.json(), min_items=0)

    async def test_filter_by_entity_type(self, client: AsyncClient, user_a: dict):
        resp = await client.get(
            "/api/v1/alerts/logs?entity_type=tax", headers=auth(user_a)
        )
        assert resp.status_code == 200
        assert "items" in resp.json()

    async def test_filter_by_status(self, client: AsyncClient, user_a: dict):
        resp = await client.get(
            "/api/v1/alerts/logs?status=sent", headers=auth(user_a)
        )
        assert resp.status_code == 200

    async def test_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/alerts/logs")
        assert resp.status_code in (401, 403)
