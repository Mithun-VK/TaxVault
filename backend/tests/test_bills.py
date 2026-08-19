"""
Recurring bill tests.

BillType: phone | electricity | wifi | gas | water | other
BillCycle: monthly | bimonthly | quarterly
DELETE → 200 (deactivate, bill still exists with is_active=False).
Paying a monthly bill advances next_due_date by 1 month.
"""
import uuid

from httpx import AsyncClient

from tests.conftest import assert_paginated, auth

_BILL = {
    "bill_type": "electricity",
    "provider_name": "TNEB",
    "billing_cycle": "monthly",
    "average_amount": "800.00",
    "next_due_date": "2026-07-10",
}


class TestCreateBill:
    async def test_success(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/bills/", headers=auth(user_a), json=_BILL)
        assert resp.status_code == 201
        data = resp.json()
        assert data["bill_type"] == "electricity"
        assert data["billing_cycle"] == "monthly"
        assert data["is_active"] is True
        assert data["user_id"] == user_a["id"]

    async def test_all_bill_types_accepted(self, client: AsyncClient, user_a: dict):
        for bt in ("phone", "electricity", "wifi", "gas", "water", "other"):
            resp = await client.post(
                "/api/v1/bills/",
                headers=auth(user_a),
                json={**_BILL, "bill_type": bt},
            )
            assert resp.status_code == 201, f"Failed for bill_type={bt}"

    async def test_all_billing_cycles_accepted(self, client: AsyncClient, user_a: dict):
        for cycle in ("monthly", "bimonthly", "quarterly"):
            resp = await client.post(
                "/api/v1/bills/",
                headers=auth(user_a),
                json={**_BILL, "billing_cycle": cycle},
            )
            assert resp.status_code == 201, f"Failed for billing_cycle={cycle}"

    async def test_custom_bill_type_is_accepted(self, client: AsyncClient, user_a: dict):
        """bill_type is a user-extensible category (see schemas/recurring_bill.py)
        - any lowercase slug is valid, not just the built-in list."""
        resp = await client.post(
            "/api/v1/bills/", headers=auth(user_a), json={**_BILL, "bill_type": "cable_tv"}
        )
        assert resp.status_code == 201
        assert resp.json()["bill_type"] == "cable_tv"

    async def test_bill_type_with_invalid_format_returns_422(
        self, client: AsyncClient, user_a: dict
    ):
        """The custom-category slug still has to match the allowed pattern
        (lowercase letters, digits, underscore)."""
        resp = await client.post(
            "/api/v1/bills/", headers=auth(user_a), json={**_BILL, "bill_type": "Cable TV!"}
        )
        assert resp.status_code == 422

    async def test_invalid_billing_cycle_returns_422(self, client: AsyncClient, user_a: dict):
        resp = await client.post(
            "/api/v1/bills/",
            headers=auth(user_a),
            json={**_BILL, "billing_cycle": "weekly"},
        )
        assert resp.status_code == 422

    async def test_missing_due_date_returns_422(self, client: AsyncClient, user_a: dict):
        payload = {k: v for k, v in _BILL.items() if k != "next_due_date"}
        resp = await client.post("/api/v1/bills/", headers=auth(user_a), json=payload)
        assert resp.status_code == 422

    async def test_creates_alert_config_automatically(
        self, client: AsyncClient, user_a: dict
    ):
        bill_resp = await client.post("/api/v1/bills/", headers=auth(user_a), json=_BILL)
        bill_id = bill_resp.json()["id"]

        alerts = await client.get(
            "/api/v1/alerts/configs?entity_type=bill", headers=auth(user_a)
        )
        entity_ids = [c["entity_id"] for c in alerts.json()["items"]]
        assert bill_id in entity_ids

    async def test_requires_auth(self, client: AsyncClient):
        resp = await client.post("/api/v1/bills/", json=_BILL)
        assert resp.status_code in (401, 403)


class TestListBills:
    async def test_returns_paginated(self, client: AsyncClient, user_a: dict, bill: dict):
        resp = await client.get("/api/v1/bills/", headers=auth(user_a))
        assert resp.status_code == 200
        assert_paginated(resp.json(), min_items=1)

    async def test_empty_for_new_user(self, client: AsyncClient, user_b: dict):
        resp = await client.get("/api/v1/bills/", headers=auth(user_b))
        assert resp.json()["total"] == 0

    async def test_admin_sees_the_shared_vault(
        self, client: AsyncClient, user_a: dict, user_b: dict, bill: dict
    ):
        """One vault, many logins - an admin reads the owner's bills."""
        resp = await client.get("/api/v1/bills/", headers=auth(user_b))
        ids = [i["id"] for i in resp.json()["items"]]
        assert bill["id"] in ids

    async def test_filter_by_bill_type(
        self, client: AsyncClient, user_a: dict, bill: dict
    ):
        resp = await client.get(
            "/api/v1/bills/?bill_type=electricity", headers=auth(user_a)
        )
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["bill_type"] == "electricity"

    async def test_filter_active_bills(
        self, client: AsyncClient, user_a: dict, bill: dict
    ):
        resp = await client.get("/api/v1/bills/?is_active=true", headers=auth(user_a))
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["is_active"] is True

    async def test_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/bills/")
        assert resp.status_code in (401, 403)


class TestGetBill:
    async def test_success(self, client: AsyncClient, user_a: dict, bill: dict):
        resp = await client.get(f"/api/v1/bills/{bill['id']}", headers=auth(user_a))
        assert resp.status_code == 200
        assert resp.json()["id"] == bill["id"]

    async def test_nonexistent_returns_404(self, client: AsyncClient, user_a: dict):
        resp = await client.get(f"/api/v1/bills/{uuid.uuid4()}", headers=auth(user_a))
        assert resp.status_code == 404

    async def test_admin_can_read_shared_bill(
        self, client: AsyncClient, user_a: dict, user_b: dict, bill: dict
    ):
        resp = await client.get(f"/api/v1/bills/{bill['id']}", headers=auth(user_b))
        assert resp.status_code == 200
        assert resp.json()["id"] == bill["id"]

    async def test_invalid_uuid_returns_422(self, client: AsyncClient, user_a: dict):
        resp = await client.get("/api/v1/bills/not-a-uuid", headers=auth(user_a))
        assert resp.status_code == 422


class TestUpdateBill:
    async def test_update_provider_name(
        self, client: AsyncClient, user_a: dict, bill: dict
    ):
        resp = await client.patch(
            f"/api/v1/bills/{bill['id']}",
            headers=auth(user_a),
            json={"provider_name": "BESCOM"},
        )
        assert resp.status_code == 200
        assert resp.json()["provider_name"] == "BESCOM"

    async def test_update_average_amount(
        self, client: AsyncClient, user_a: dict, bill: dict
    ):
        resp = await client.patch(
            f"/api/v1/bills/{bill['id']}",
            headers=auth(user_a),
            json={"average_amount": "1200.00"},
        )
        assert resp.status_code == 200
        assert float(resp.json()["average_amount"]) == 1200.00

    async def test_admin_cannot_update(
        self, client: AsyncClient, user_a: dict, user_b: dict, bill: dict
    ):
        """Admins add records but never change them."""
        resp = await client.patch(
            f"/api/v1/bills/{bill['id']}",
            headers=auth(user_b),
            json={"provider_name": "Changed"},
        )
        assert resp.status_code == 403


class TestPayBill:
    async def test_monthly_bill_advances_due_date_by_one_month(
        self, client: AsyncClient, user_a: dict
    ):
        create = await client.post(
            "/api/v1/bills/",
            headers=auth(user_a),
            json={**_BILL, "next_due_date": "2026-07-05"},
        )
        bill_id = create.json()["id"]

        resp = await client.post(
            f"/api/v1/bills/{bill_id}/pay",
            headers=auth(user_a),
            json={"amount_paid": "800.00", "payment_date": "2026-07-05"},
        )
        assert resp.status_code == 200
        assert resp.json()["next_due_date"] == "2026-08-05"

    async def test_quarterly_bill_advances_by_three_months(
        self, client: AsyncClient, user_a: dict
    ):
        create = await client.post(
            "/api/v1/bills/",
            headers=auth(user_a),
            json={**_BILL, "billing_cycle": "quarterly", "next_due_date": "2026-04-01"},
        )
        bill_id = create.json()["id"]

        resp = await client.post(
            f"/api/v1/bills/{bill_id}/pay",
            headers=auth(user_a),
            json={"amount_paid": "2400.00", "payment_date": "2026-04-01"},
        )
        assert resp.status_code == 200
        assert resp.json()["next_due_date"] == "2026-07-01"

    async def test_pay_creates_payment_record(self, client: AsyncClient, user_a: dict):
        create = await client.post("/api/v1/bills/", headers=auth(user_a), json=_BILL)
        bill_id = create.json()["id"]

        await client.post(
            f"/api/v1/bills/{bill_id}/pay",
            headers=auth(user_a),
            json={"amount_paid": "800.00", "payment_date": "2026-07-10"},
        )
        payments = await client.get("/api/v1/payments/", headers=auth(user_a))
        entity_ids = [p["entity_id"] for p in payments.json()["items"]]
        assert bill_id in entity_ids

    async def test_admin_can_log_a_payment(
        self, client: AsyncClient, user_a: dict, user_b: dict, bill: dict
    ):
        """Logging a payment is an add, not an edit - admins may do it."""
        resp = await client.post(
            f"/api/v1/bills/{bill['id']}/pay",
            headers=auth(user_b),
            json={"amount_paid": "800.00", "payment_date": "2026-07-10"},
        )
        assert resp.status_code == 200


class TestDeactivateBill:
    async def test_deactivate_returns_200(self, client: AsyncClient, user_a: dict):
        create = await client.post("/api/v1/bills/", headers=auth(user_a), json=_BILL)
        bill_id = create.json()["id"]
        resp = await client.delete(f"/api/v1/bills/{bill_id}", headers=auth(user_a))
        assert resp.status_code == 200
        assert "detail" in resp.json()

    async def test_bill_still_accessible_after_deactivate(
        self, client: AsyncClient, user_a: dict
    ):
        """Deactivate sets is_active=False but does not archive - GET still returns 200."""
        create = await client.post("/api/v1/bills/", headers=auth(user_a), json=_BILL)
        bill_id = create.json()["id"]
        await client.delete(f"/api/v1/bills/{bill_id}", headers=auth(user_a))

        get = await client.get(f"/api/v1/bills/{bill_id}", headers=auth(user_a))
        assert get.status_code == 200
        assert get.json()["is_active"] is False

    async def test_admin_cannot_deactivate(
        self, client: AsyncClient, user_a: dict, user_b: dict, bill: dict
    ):
        resp = await client.delete(
            f"/api/v1/bills/{bill['id']}", headers=auth(user_b)
        )
        assert resp.status_code == 403

    async def test_nonexistent_deactivate_returns_404(
        self, client: AsyncClient, user_a: dict
    ):
        resp = await client.delete(
            f"/api/v1/bills/{uuid.uuid4()}", headers=auth(user_a)
        )
        assert resp.status_code == 404
