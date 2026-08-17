"""
Tax obligation tests.

TaxType: land_tax | water_tax | property_tax | professional_tax | income_tax | other
ObligationStatus: pending | paid | overdue | exempt
RecurrenceRule: ANNUAL | QUARTERLY | MONTHLY

Paying full amount → status = paid (or next cycle if recurrence_rule set).
Paying partial → status stays pending.
DELETE → 200, then GET → 404.
Creating a tax auto-creates an AlertConfig.
"""
import uuid

from httpx import AsyncClient

from tests.conftest import assert_paginated, auth

_TAX = {
    "tax_type": "property_tax",
    "due_date": "2026-09-30",
    "total_amount": "5000.00",
    "jurisdiction": "Chennai Corporation",
    "assessment_year": "2025-26",
}


class TestCreateTax:
    async def test_success(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/taxes/", headers=auth(user_a), json=_TAX)
        assert resp.status_code == 201
        data = resp.json()
        assert data["tax_type"] == "property_tax"
        assert data["status"] == "pending"
        assert data["user_id"] == user_a["id"]
        assert "id" in data

    async def test_all_tax_types_accepted(self, client: AsyncClient, user_a: dict):
        for t in ("land_tax", "water_tax", "property_tax", "professional_tax", "income_tax", "other"):
            resp = await client.post(
                "/api/v1/taxes/",
                headers=auth(user_a),
                json={**_TAX, "tax_type": t},
            )
            assert resp.status_code == 201, f"Failed for tax_type={t}: {resp.json()}"

    async def test_linked_to_own_asset(
        self, client: AsyncClient, user_a: dict, building: dict
    ):
        resp = await client.post(
            "/api/v1/taxes/",
            headers=auth(user_a),
            json={**_TAX, "asset_id": building["id"]},
        )
        assert resp.status_code == 201
        assert resp.json()["asset_id"] == building["id"]

    async def test_admin_can_link_to_a_shared_asset(
        self, client: AsyncClient, user_a: dict, user_b: dict, building: dict
    ):
        """The asset is in the shared vault, so an admin may file a tax on it."""
        resp = await client.post(
            "/api/v1/taxes/",
            headers=auth(user_b),
            json={**_TAX, "asset_id": building["id"]},
        )
        assert resp.status_code == 201

    async def test_custom_tax_type_is_accepted(self, client: AsyncClient, user_a: dict):
        """tax_type is a user-extensible category (see schemas/tax_obligation.py)
        — any non-empty string up to 50 chars is valid, not just the built-in
        list."""
        resp = await client.post(
            "/api/v1/taxes/",
            headers=auth(user_a),
            json={**_TAX, "tax_type": "alien_tax"},
        )
        assert resp.status_code == 201
        assert resp.json()["tax_type"] == "alien_tax"

    async def test_empty_tax_type_returns_422(self, client: AsyncClient, user_a: dict):
        resp = await client.post(
            "/api/v1/taxes/",
            headers=auth(user_a),
            json={**_TAX, "tax_type": ""},
        )
        assert resp.status_code == 422

    async def test_invalid_due_date_returns_422(self, client: AsyncClient, user_a: dict):
        resp = await client.post(
            "/api/v1/taxes/",
            headers=auth(user_a),
            json={**_TAX, "due_date": "not-a-date"},
        )
        assert resp.status_code == 422

    async def test_missing_due_date_returns_422(self, client: AsyncClient, user_a: dict):
        payload = {k: v for k, v in _TAX.items() if k != "due_date"}
        resp = await client.post("/api/v1/taxes/", headers=auth(user_a), json=payload)
        assert resp.status_code == 422

    async def test_creates_alert_config_automatically(
        self, client: AsyncClient, user_a: dict
    ):
        """Creating a tax obligation auto-creates an AlertConfig for that entity."""
        tax_resp = await client.post("/api/v1/taxes/", headers=auth(user_a), json=_TAX)
        tax_id = tax_resp.json()["id"]

        alerts = await client.get(
            f"/api/v1/alerts/configs?entity_type=tax",
            headers=auth(user_a),
        )
        assert alerts.status_code == 200
        entity_ids = [c["entity_id"] for c in alerts.json()["items"]]
        assert tax_id in entity_ids

    async def test_requires_auth(self, client: AsyncClient):
        resp = await client.post("/api/v1/taxes/", json=_TAX)
        assert resp.status_code in (401, 403)


class TestListTaxes:
    async def test_returns_paginated(self, client: AsyncClient, user_a: dict, tax: dict):
        resp = await client.get("/api/v1/taxes/", headers=auth(user_a))
        assert resp.status_code == 200
        assert_paginated(resp.json(), min_items=1)

    async def test_empty_for_new_user(self, client: AsyncClient, user_b: dict):
        resp = await client.get("/api/v1/taxes/", headers=auth(user_b))
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    async def test_admin_sees_the_shared_vault(
        self, client: AsyncClient, user_a: dict, user_b: dict, tax: dict
    ):
        resp = await client.get("/api/v1/taxes/", headers=auth(user_b))
        ids = [i["id"] for i in resp.json()["items"]]
        assert tax["id"] in ids

    async def test_filter_by_status_pending(
        self, client: AsyncClient, user_a: dict, tax: dict
    ):
        resp = await client.get("/api/v1/taxes/?status=pending", headers=auth(user_a))
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["status"] == "pending"

    async def test_filter_by_tax_type(
        self, client: AsyncClient, user_a: dict, tax: dict
    ):
        resp = await client.get(
            "/api/v1/taxes/?tax_type=property_tax", headers=auth(user_a)
        )
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["tax_type"] == "property_tax"

    async def test_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/taxes/")
        assert resp.status_code in (401, 403)


class TestGetTax:
    async def test_success(self, client: AsyncClient, user_a: dict, tax: dict):
        resp = await client.get(f"/api/v1/taxes/{tax['id']}", headers=auth(user_a))
        assert resp.status_code == 200
        assert resp.json()["id"] == tax["id"]

    async def test_nonexistent_returns_404(self, client: AsyncClient, user_a: dict):
        resp = await client.get(f"/api/v1/taxes/{uuid.uuid4()}", headers=auth(user_a))
        assert resp.status_code == 404

    async def test_admin_can_read_shared_tax(
        self, client: AsyncClient, user_a: dict, user_b: dict, tax: dict
    ):
        resp = await client.get(f"/api/v1/taxes/{tax['id']}", headers=auth(user_b))
        assert resp.status_code == 200

    async def test_invalid_uuid_returns_422(self, client: AsyncClient, user_a: dict):
        resp = await client.get("/api/v1/taxes/not-a-uuid", headers=auth(user_a))
        assert resp.status_code == 422


class TestUpdateTax:
    async def test_update_jurisdiction(self, client: AsyncClient, user_a: dict, tax: dict):
        resp = await client.patch(
            f"/api/v1/taxes/{tax['id']}",
            headers=auth(user_a),
            json={"jurisdiction": "Updated Corporation"},
        )
        assert resp.status_code == 200
        assert resp.json()["jurisdiction"] == "Updated Corporation"

    async def test_update_due_date(self, client: AsyncClient, user_a: dict, tax: dict):
        resp = await client.patch(
            f"/api/v1/taxes/{tax['id']}",
            headers=auth(user_a),
            json={"due_date": "2026-12-31"},
        )
        assert resp.status_code == 200
        assert resp.json()["due_date"] == "2026-12-31"

    async def test_admin_cannot_update(
        self, client: AsyncClient, user_a: dict, user_b: dict, tax: dict
    ):
        resp = await client.patch(
            f"/api/v1/taxes/{tax['id']}",
            headers=auth(user_b),
            json={"jurisdiction": "Changed"},
        )
        assert resp.status_code == 403


class TestPayTax:
    async def test_full_payment_changes_status_to_paid(
        self, client: AsyncClient, user_a: dict
    ):
        create = await client.post("/api/v1/taxes/", headers=auth(user_a), json=_TAX)
        tax_id = create.json()["id"]

        resp = await client.post(
            f"/api/v1/taxes/{tax_id}/pay",
            headers=auth(user_a),
            json={
                "amount_paid": "5000.00",
                "payment_date": "2026-09-25",
                "payment_method": "upi",
                "reference_number": "UPI123456789",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "paid"

    async def test_partial_payment_keeps_status_pending(
        self, client: AsyncClient, user_a: dict
    ):
        create = await client.post("/api/v1/taxes/", headers=auth(user_a), json=_TAX)
        tax_id = create.json()["id"]

        resp = await client.post(
            f"/api/v1/taxes/{tax_id}/pay",
            headers=auth(user_a),
            json={"amount_paid": "1000.00", "payment_date": "2026-09-25"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"

    async def test_payment_creates_payment_record(
        self, client: AsyncClient, user_a: dict
    ):
        create = await client.post("/api/v1/taxes/", headers=auth(user_a), json=_TAX)
        tax_id = create.json()["id"]

        await client.post(
            f"/api/v1/taxes/{tax_id}/pay",
            headers=auth(user_a),
            json={"amount_paid": "5000.00", "payment_date": "2026-09-25"},
        )
        payments = await client.get("/api/v1/payments/", headers=auth(user_a))
        entity_ids = [p["entity_id"] for p in payments.json()["items"]]
        assert tax_id in entity_ids

    async def test_recurring_tax_advances_date_on_full_payment(
        self, client: AsyncClient, user_a: dict
    ):
        create = await client.post(
            "/api/v1/taxes/",
            headers=auth(user_a),
            json={**_TAX, "recurrence_rule": "ANNUAL"},
        )
        tax_id = create.json()["id"]
        original_due = create.json()["due_date"]

        resp = await client.post(
            f"/api/v1/taxes/{tax_id}/pay",
            headers=auth(user_a),
            json={"amount_paid": "5000.00", "payment_date": "2026-09-25"},
        )
        assert resp.status_code == 200
        assert resp.json()["due_date"] != original_due
        assert resp.json()["status"] == "pending"  # reset for next cycle

    async def test_admin_can_log_a_payment(
        self, client: AsyncClient, user_a: dict, user_b: dict, tax: dict
    ):
        resp = await client.post(
            f"/api/v1/taxes/{tax['id']}/pay",
            headers=auth(user_b),
            json={"amount_paid": "5000.00", "payment_date": "2026-09-25"},
        )
        assert resp.status_code == 200

    async def test_missing_amount_returns_422(
        self, client: AsyncClient, user_a: dict, tax: dict
    ):
        resp = await client.post(
            f"/api/v1/taxes/{tax['id']}/pay",
            headers=auth(user_a),
            json={"payment_date": "2026-09-25"},
        )
        assert resp.status_code == 422


class TestDeleteTax:
    async def test_archive_returns_200(self, client: AsyncClient, user_a: dict):
        create = await client.post("/api/v1/taxes/", headers=auth(user_a), json=_TAX)
        tax_id = create.json()["id"]
        resp = await client.delete(f"/api/v1/taxes/{tax_id}", headers=auth(user_a))
        assert resp.status_code == 200
        assert "detail" in resp.json()

    async def test_get_after_archive_returns_404(self, client: AsyncClient, user_a: dict):
        create = await client.post("/api/v1/taxes/", headers=auth(user_a), json=_TAX)
        tax_id = create.json()["id"]
        await client.delete(f"/api/v1/taxes/{tax_id}", headers=auth(user_a))
        get = await client.get(f"/api/v1/taxes/{tax_id}", headers=auth(user_a))
        assert get.status_code == 404

    async def test_admin_cannot_archive(
        self, client: AsyncClient, user_a: dict, user_b: dict, tax: dict
    ):
        resp = await client.delete(
            f"/api/v1/taxes/{tax['id']}", headers=auth(user_b)
        )
        assert resp.status_code == 403
