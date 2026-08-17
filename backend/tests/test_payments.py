"""
Payment listing and management tests.

Payments are created as side-effects of paying taxes/bills/insurance.
GET  /payments/           → list with optional entity_type filter + date range
GET  /payments/{id}       → single payment
PATCH /payments/{id}      → update notes/method/reference
DELETE /payments/{id}     → 200

EntityType: asset | insurance | tax | bill
PaymentMethod: cash | bank_transfer | upi | card | cheque
"""
import uuid

from httpx import AsyncClient

from tests.conftest import assert_paginated, auth


async def _create_tax_payment(client: AsyncClient, user: dict) -> tuple[str, str]:
    """Create a tax + pay it, return (tax_id, payment_id)."""
    tax = await client.post(
        "/api/v1/taxes/",
        headers=auth(user),
        json={
            "tax_type": "income_tax",
            "due_date": "2026-07-31",
            "total_amount": "10000.00",
        },
    )
    assert tax.status_code == 201
    tax_id = tax.json()["id"]

    await client.post(
        f"/api/v1/taxes/{tax_id}/pay",
        headers=auth(user),
        json={
            "amount_paid": "10000.00",
            "payment_date": "2026-07-20",
            "payment_method": "upi",
            "reference_number": "UPI-PAY-001",
        },
    )
    payments = await client.get("/api/v1/payments/", headers=auth(user))
    payment_id = payments.json()["items"][0]["id"]
    return tax_id, payment_id


class TestListPayments:
    async def test_empty_list_initially(self, client: AsyncClient, user_a: dict):
        resp = await client.get("/api/v1/payments/", headers=auth(user_a))
        assert resp.status_code == 200
        assert_paginated(resp.json(), min_items=0)

    async def test_payment_appears_after_paying_tax(
        self, client: AsyncClient, user_a: dict
    ):
        tax_id, _ = await _create_tax_payment(client, user_a)
        resp = await client.get("/api/v1/payments/", headers=auth(user_a))
        assert_paginated(resp.json(), min_items=1)
        entity_ids = [p["entity_id"] for p in resp.json()["items"]]
        assert tax_id in entity_ids

    async def test_filter_by_entity_type_tax(self, client: AsyncClient, user_a: dict):
        await _create_tax_payment(client, user_a)
        resp = await client.get(
            "/api/v1/payments/?entity_type=tax", headers=auth(user_a)
        )
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["entity_type"] == "tax"

    async def test_filter_by_date_range(self, client: AsyncClient, user_a: dict):
        await _create_tax_payment(client, user_a)
        resp = await client.get(
            "/api/v1/payments/?from=2026-07-01&to=2026-07-31",
            headers=auth(user_a),
        )
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert "2026-07" in item["payment_date"]

    async def test_admin_sees_the_shared_ledger(
        self, client: AsyncClient, user_a: dict, user_b: dict
    ):
        await _create_tax_payment(client, user_a)
        resp = await client.get("/api/v1/payments/", headers=auth(user_b))
        assert resp.json()["total"] >= 1

    async def test_pagination(self, client: AsyncClient, user_a: dict):
        # Create 3 payments via 3 separate tax pays
        for i in range(3):
            tax = await client.post(
                "/api/v1/taxes/",
                headers=auth(user_a),
                json={"tax_type": "water_tax", "due_date": "2026-08-01", "total_amount": "100.00"},
            )
            await client.post(
                f"/api/v1/taxes/{tax.json()['id']}/pay",
                headers=auth(user_a),
                json={"amount_paid": "100.00", "payment_date": "2026-07-15"},
            )
        resp = await client.get("/api/v1/payments/?skip=0&limit=2", headers=auth(user_a))
        assert len(resp.json()["items"]) <= 2

    async def test_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/payments/")
        assert resp.status_code in (401, 403)


class TestGetPayment:
    async def test_success(self, client: AsyncClient, user_a: dict):
        _, payment_id = await _create_tax_payment(client, user_a)
        resp = await client.get(f"/api/v1/payments/{payment_id}", headers=auth(user_a))
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == payment_id
        assert data["entity_type"] == "tax"
        assert float(data["amount_paid"]) == 10000.00

    async def test_nonexistent_returns_404(self, client: AsyncClient, user_a: dict):
        resp = await client.get(f"/api/v1/payments/{uuid.uuid4()}", headers=auth(user_a))
        assert resp.status_code == 404

    async def test_admin_can_read_a_payment(
        self, client: AsyncClient, user_a: dict, user_b: dict
    ):
        _, payment_id = await _create_tax_payment(client, user_a)
        resp = await client.get(
            f"/api/v1/payments/{payment_id}", headers=auth(user_b)
        )
        assert resp.status_code == 200

    async def test_invalid_uuid_returns_422(self, client: AsyncClient, user_a: dict):
        resp = await client.get("/api/v1/payments/not-a-uuid", headers=auth(user_a))
        assert resp.status_code == 422


class TestUpdatePayment:
    async def test_update_notes(self, client: AsyncClient, user_a: dict):
        _, payment_id = await _create_tax_payment(client, user_a)
        resp = await client.patch(
            f"/api/v1/payments/{payment_id}",
            headers=auth(user_a),
            json={"notes": "Paid via NEFT on time"},
        )
        assert resp.status_code == 200
        assert resp.json()["notes"] == "Paid via NEFT on time"

    async def test_update_payment_method(self, client: AsyncClient, user_a: dict):
        _, payment_id = await _create_tax_payment(client, user_a)
        resp = await client.patch(
            f"/api/v1/payments/{payment_id}",
            headers=auth(user_a),
            json={"payment_method": "bank_transfer"},
        )
        assert resp.status_code == 200
        assert resp.json()["payment_method"] == "bank_transfer"

    async def test_update_reference_number(self, client: AsyncClient, user_a: dict):
        _, payment_id = await _create_tax_payment(client, user_a)
        resp = await client.patch(
            f"/api/v1/payments/{payment_id}",
            headers=auth(user_a),
            json={"reference_number": "TXN-UPDATED-001"},
        )
        assert resp.status_code == 200
        assert resp.json()["reference_number"] == "TXN-UPDATED-001"

    async def test_invalid_payment_method_returns_422(
        self, client: AsyncClient, user_a: dict
    ):
        _, payment_id = await _create_tax_payment(client, user_a)
        resp = await client.patch(
            f"/api/v1/payments/{payment_id}",
            headers=auth(user_a),
            json={"payment_method": "bitcoin"},
        )
        assert resp.status_code == 422

    async def test_admin_cannot_amend_a_payment(
        self, client: AsyncClient, user_a: dict, user_b: dict
    ):
        _, payment_id = await _create_tax_payment(client, user_a)
        resp = await client.patch(
            f"/api/v1/payments/{payment_id}",
            headers=auth(user_b),
            json={"notes": "Amended"},
        )
        assert resp.status_code == 403


class TestDeletePayment:
    async def test_delete_returns_200(self, client: AsyncClient, user_a: dict):
        _, payment_id = await _create_tax_payment(client, user_a)
        resp = await client.delete(
            f"/api/v1/payments/{payment_id}", headers=auth(user_a)
        )
        assert resp.status_code == 200
        assert "detail" in resp.json()

    async def test_get_after_delete_returns_404(self, client: AsyncClient, user_a: dict):
        _, payment_id = await _create_tax_payment(client, user_a)
        await client.delete(f"/api/v1/payments/{payment_id}", headers=auth(user_a))
        resp = await client.get(f"/api/v1/payments/{payment_id}", headers=auth(user_a))
        assert resp.status_code == 404

    async def test_admin_cannot_delete_a_payment(
        self, client: AsyncClient, user_a: dict, user_b: dict
    ):
        _, payment_id = await _create_tax_payment(client, user_a)
        resp = await client.delete(
            f"/api/v1/payments/{payment_id}", headers=auth(user_b)
        )
        assert resp.status_code == 403
