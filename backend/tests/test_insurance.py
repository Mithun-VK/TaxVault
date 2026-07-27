"""
Insurance policy tests.

InsuranceType: medical | life | vehicle | property | other
PremiumFrequency: monthly | quarterly | half_yearly | annual
DELETE → 200 (archive). GET after → 404.
Pay premium → advances next_premium_date by one period.
"""
import uuid

from httpx import AsyncClient

from tests.conftest import assert_paginated, auth

_POLICY = {
    "policy_number": "LIC-001",
    "provider_name": "LIC",
    "insurance_type": "life",
    "premium_amount": "12000.00",
    "premium_frequency": "annual",
    "next_premium_date": "2027-01-01",
    "policy_start_date": "2020-01-01",
}


class TestCreateInsurance:
    async def test_success(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/insurance/", headers=auth(user_a), json=_POLICY)
        assert resp.status_code == 201
        data = resp.json()
        assert data["policy_number"] == "LIC-001"
        assert data["insurance_type"] == "life"
        assert data["status"] == "active"
        assert data["user_id"] == user_a["id"]

    async def test_all_insurance_types(self, client: AsyncClient, user_a: dict):
        for i, it in enumerate(("medical", "life", "vehicle", "property", "other")):
            resp = await client.post(
                "/api/v1/insurance/",
                headers=auth(user_a),
                json={**_POLICY, "insurance_type": it, "policy_number": f"POL-{i}"},
            )
            assert resp.status_code == 201, f"Failed for type={it}"

    async def test_all_premium_frequencies(self, client: AsyncClient, user_a: dict):
        for i, freq in enumerate(("monthly", "quarterly", "half_yearly", "annual")):
            resp = await client.post(
                "/api/v1/insurance/",
                headers=auth(user_a),
                json={**_POLICY, "premium_frequency": freq, "policy_number": f"FREQ-{i}"},
            )
            assert resp.status_code == 201, f"Failed for frequency={freq}"

    async def test_invalid_insurance_type_returns_422(
        self, client: AsyncClient, user_a: dict
    ):
        resp = await client.post(
            "/api/v1/insurance/",
            headers=auth(user_a),
            json={**_POLICY, "insurance_type": "dental"},
        )
        assert resp.status_code == 422

    async def test_missing_policy_number_returns_422(
        self, client: AsyncClient, user_a: dict
    ):
        payload = {k: v for k, v in _POLICY.items() if k != "policy_number"}
        resp = await client.post("/api/v1/insurance/", headers=auth(user_a), json=payload)
        assert resp.status_code == 422

    async def test_missing_provider_name_returns_422(
        self, client: AsyncClient, user_a: dict
    ):
        payload = {k: v for k, v in _POLICY.items() if k != "provider_name"}
        resp = await client.post("/api/v1/insurance/", headers=auth(user_a), json=payload)
        assert resp.status_code == 422

    async def test_missing_premium_amount_returns_422(
        self, client: AsyncClient, user_a: dict
    ):
        payload = {k: v for k, v in _POLICY.items() if k != "premium_amount"}
        resp = await client.post("/api/v1/insurance/", headers=auth(user_a), json=payload)
        assert resp.status_code == 422

    async def test_creates_alert_config_automatically(
        self, client: AsyncClient, user_a: dict
    ):
        pol = await client.post("/api/v1/insurance/", headers=auth(user_a), json=_POLICY)
        pol_id = pol.json()["id"]

        alerts = await client.get(
            "/api/v1/alerts/configs?entity_type=insurance", headers=auth(user_a)
        )
        entity_ids = [c["entity_id"] for c in alerts.json()["items"]]
        assert pol_id in entity_ids

    async def test_requires_auth(self, client: AsyncClient):
        resp = await client.post("/api/v1/insurance/", json=_POLICY)
        assert resp.status_code in (401, 403)


class TestListInsurance:
    async def test_returns_paginated(
        self, client: AsyncClient, user_a: dict, insurance: dict
    ):
        resp = await client.get("/api/v1/insurance/", headers=auth(user_a))
        assert resp.status_code == 200
        assert_paginated(resp.json(), min_items=1)

    async def test_empty_for_new_user(self, client: AsyncClient, user_b: dict):
        resp = await client.get("/api/v1/insurance/", headers=auth(user_b))
        assert resp.json()["total"] == 0

    async def test_isolation(
        self, client: AsyncClient, user_a: dict, user_b: dict, insurance: dict
    ):
        resp = await client.get("/api/v1/insurance/", headers=auth(user_b))
        ids = [i["id"] for i in resp.json()["items"]]
        assert insurance["id"] not in ids

    async def test_filter_by_insurance_type(
        self, client: AsyncClient, user_a: dict, insurance: dict
    ):
        resp = await client.get(
            "/api/v1/insurance/?insurance_type=life", headers=auth(user_a)
        )
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["insurance_type"] == "life"

    async def test_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/insurance/")
        assert resp.status_code in (401, 403)


class TestGetInsurance:
    async def test_success(self, client: AsyncClient, user_a: dict, insurance: dict):
        resp = await client.get(f"/api/v1/insurance/{insurance['id']}", headers=auth(user_a))
        assert resp.status_code == 200
        assert resp.json()["id"] == insurance["id"]

    async def test_nonexistent_returns_404(self, client: AsyncClient, user_a: dict):
        resp = await client.get(f"/api/v1/insurance/{uuid.uuid4()}", headers=auth(user_a))
        assert resp.status_code == 404

    async def test_idor_returns_404(
        self, client: AsyncClient, user_a: dict, user_b: dict, insurance: dict
    ):
        resp = await client.get(
            f"/api/v1/insurance/{insurance['id']}", headers=auth(user_b)
        )
        assert resp.status_code == 404

    async def test_invalid_uuid_returns_422(self, client: AsyncClient, user_a: dict):
        resp = await client.get("/api/v1/insurance/not-a-uuid", headers=auth(user_a))
        assert resp.status_code == 422


class TestUpdateInsurance:
    async def test_update_nominee_name(
        self, client: AsyncClient, user_a: dict, insurance: dict
    ):
        resp = await client.patch(
            f"/api/v1/insurance/{insurance['id']}",
            headers=auth(user_a),
            json={"nominee_name": "Felci Rajam"},
        )
        assert resp.status_code == 200
        assert resp.json()["nominee_name"] == "Felci Rajam"

    async def test_update_sum_insured(
        self, client: AsyncClient, user_a: dict, insurance: dict
    ):
        resp = await client.patch(
            f"/api/v1/insurance/{insurance['id']}",
            headers=auth(user_a),
            json={"sum_insured": "10000000.00"},
        )
        assert resp.status_code == 200
        assert float(resp.json()["sum_insured"]) == 10000000.00

    async def test_update_status(
        self, client: AsyncClient, user_a: dict, insurance: dict
    ):
        resp = await client.patch(
            f"/api/v1/insurance/{insurance['id']}",
            headers=auth(user_a),
            json={"status": "lapsed"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "lapsed"

    async def test_invalid_status_returns_422(
        self, client: AsyncClient, user_a: dict, insurance: dict
    ):
        resp = await client.patch(
            f"/api/v1/insurance/{insurance['id']}",
            headers=auth(user_a),
            json={"status": "ghost"},
        )
        assert resp.status_code == 422

    async def test_idor_update_returns_404(
        self, client: AsyncClient, user_a: dict, user_b: dict, insurance: dict
    ):
        resp = await client.patch(
            f"/api/v1/insurance/{insurance['id']}",
            headers=auth(user_b),
            json={"nominee_name": "Hacked"},
        )
        assert resp.status_code == 404


class TestPayPremium:
    async def test_annual_premium_advances_date_by_one_year(
        self, client: AsyncClient, user_a: dict
    ):
        create = await client.post(
            "/api/v1/insurance/",
            headers=auth(user_a),
            json={**_POLICY, "next_premium_date": "2026-07-01"},
        )
        policy_id = create.json()["id"]

        resp = await client.post(
            f"/api/v1/insurance/{policy_id}/pay-premium",
            headers=auth(user_a),
            json={"amount_paid": "12000.00", "payment_date": "2026-07-01"},
        )
        assert resp.status_code == 200
        assert resp.json()["next_premium_date"] == "2027-07-01"

    async def test_quarterly_premium_advances_by_3_months(
        self, client: AsyncClient, user_a: dict
    ):
        create = await client.post(
            "/api/v1/insurance/",
            headers=auth(user_a),
            json={
                **_POLICY,
                "premium_frequency": "quarterly",
                "policy_number": "QPOL-001",
                "next_premium_date": "2026-04-01",
            },
        )
        policy_id = create.json()["id"]

        resp = await client.post(
            f"/api/v1/insurance/{policy_id}/pay-premium",
            headers=auth(user_a),
            json={"amount_paid": "3000.00", "payment_date": "2026-04-01"},
        )
        assert resp.status_code == 200
        assert resp.json()["next_premium_date"] == "2026-07-01"

    async def test_pay_creates_payment_record(self, client: AsyncClient, user_a: dict):
        create = await client.post("/api/v1/insurance/", headers=auth(user_a), json=_POLICY)
        pol_id = create.json()["id"]

        await client.post(
            f"/api/v1/insurance/{pol_id}/pay-premium",
            headers=auth(user_a),
            json={"amount_paid": "12000.00", "payment_date": "2027-01-01"},
        )
        payments = await client.get("/api/v1/payments/", headers=auth(user_a))
        entity_ids = [p["entity_id"] for p in payments.json()["items"]]
        assert pol_id in entity_ids

    async def test_idor_pay_premium_returns_404(
        self, client: AsyncClient, user_a: dict, user_b: dict, insurance: dict
    ):
        resp = await client.post(
            f"/api/v1/insurance/{insurance['id']}/pay-premium",
            headers=auth(user_b),
            json={"amount_paid": "12000.00", "payment_date": "2027-01-01"},
        )
        assert resp.status_code == 404


class TestDeleteInsurance:
    async def test_archive_returns_200(self, client: AsyncClient, user_a: dict):
        create = await client.post("/api/v1/insurance/", headers=auth(user_a), json=_POLICY)
        pol_id = create.json()["id"]
        resp = await client.delete(f"/api/v1/insurance/{pol_id}", headers=auth(user_a))
        assert resp.status_code == 200
        assert "detail" in resp.json()

    async def test_get_after_archive_returns_404(self, client: AsyncClient, user_a: dict):
        create = await client.post("/api/v1/insurance/", headers=auth(user_a), json=_POLICY)
        pol_id = create.json()["id"]
        await client.delete(f"/api/v1/insurance/{pol_id}", headers=auth(user_a))
        get = await client.get(f"/api/v1/insurance/{pol_id}", headers=auth(user_a))
        assert get.status_code == 404

    async def test_idor_delete_returns_404(
        self, client: AsyncClient, user_a: dict, user_b: dict, insurance: dict
    ):
        resp = await client.delete(
            f"/api/v1/insurance/{insurance['id']}", headers=auth(user_b)
        )
        assert resp.status_code == 404
