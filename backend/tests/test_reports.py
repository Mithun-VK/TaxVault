"""
Tests for the rework: payment receipt linkage, the year calendar grid endpoint,
and the financial report endpoints (payables pivot + asset register).
"""
from httpx import AsyncClient

from tests.conftest import auth


class TestReceiptLinkage:
    async def test_pay_bill_links_receipt_document(
        self, client: AsyncClient, user_a: dict, bill: dict
    ):
        # Upload a receipt document first
        doc = await client.post(
            "/api/v1/documents/",
            headers=auth(user_a),
            json={
                "label": "TNEB receipt July",
                "storage_key": "user/library/bills/receipt.pdf",
                "category": "bills",
                "file_name": "receipt.pdf",
                "mime_type": "application/pdf",
            },
        )
        assert doc.status_code == 201
        doc_id = doc.json()["id"]

        pay = await client.post(
            f"/api/v1/bills/{bill['id']}/pay",
            headers=auth(user_a),
            json={
                "amount_paid": "800.00",
                "payment_date": "2026-07-10",
                "payment_method": "upi",
                "receipt_document_id": doc_id,
            },
        )
        assert pay.status_code == 200

        payments = await client.get(
            "/api/v1/payments/", headers=auth(user_a), params={"entity_type": "bill"}
        )
        assert payments.status_code == 200
        rows = payments.json()["items"]
        assert len(rows) == 1
        assert rows[0]["receipt_document_id"] == doc_id


class TestCalendarYear:
    async def test_monthly_bill_projected_across_year(
        self, client: AsyncClient, user_a: dict, bill: dict
    ):
        # bill fixture: monthly, next_due_date 2026-07-10
        resp = await client.get(
            "/api/v1/dashboard/calendar-year", headers=auth(user_a), params={"year": 2026}
        )
        assert resp.status_code == 200
        items = resp.json()
        bill_items = [i for i in items if i["entity_type"] == "bill"]
        # Monthly bill due on the 10th → every month is projected (12 occurrences)
        assert len(bill_items) == 12
        assert all(i["due_date"].endswith("-10") for i in bill_items)
        assert {i["status"] for i in bill_items} <= {"paid", "due", "overdue"}


class TestPayablesReport:
    async def test_bill_monthly_pivot(self, client: AsyncClient, user_a: dict, bill: dict):
        for d, amt in [("2026-07-10", "800.00"), ("2026-08-10", "950.00")]:
            r = await client.post(
                f"/api/v1/bills/{bill['id']}/pay",
                headers=auth(user_a),
                json={"amount_paid": amt, "payment_date": d, "payment_method": "upi"},
            )
            assert r.status_code == 200

        resp = await client.get(
            "/api/v1/reports/payables",
            headers=auth(user_a),
            params={"type": "bill", "year": 2026},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["year"] == 2026
        row = next(r for r in data["rows"] if r["entity_id"] == bill["id"])
        assert float(row["months"]["7"]) == 800.0
        assert float(row["months"]["8"]) == 950.0
        assert float(row["total"]) == 1750.0
        assert row["subtype"] == "electricity"


class TestAssetRegister:
    async def test_lists_assets(self, client: AsyncClient, user_a: dict, building: dict):
        resp = await client.get("/api/v1/reports/assets", headers=auth(user_a))
        assert resp.status_code == 200
        rows = resp.json()["rows"]
        assert any(r["id"] == building["id"] for r in rows)

    async def test_vehicle_only_excludes_building(
        self, client: AsyncClient, user_a: dict, building: dict
    ):
        resp = await client.get(
            "/api/v1/reports/assets", headers=auth(user_a), params={"vehicle_only": True}
        )
        assert resp.status_code == 200
        rows = resp.json()["rows"]
        assert all(r["asset_type"] == "vehicle" for r in rows)
        assert not any(r["id"] == building["id"] for r in rows)
