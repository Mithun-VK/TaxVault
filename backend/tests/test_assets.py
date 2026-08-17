"""
Asset endpoint tests — CRUD, RBAC, filtering, pagination.

AssetType: land | vehicle | building | other
AssetStatus: active | sold | transferred
metadata is sent/received as "metadata" (alias for asset_metadata field).
DELETE → 200, then GET → 404 (soft archive).
"""
import uuid

from httpx import AsyncClient

from tests.conftest import assert_paginated, auth

_BUILDING = {
    "asset_type": "building",
    "name": "Chennai Office Building",
    "acquisition_cost": "8500000.00",
    "current_value": "9200000.00",
    "metadata": {"address": "456 Anna Salai, Chennai"},
}

_LAND = {
    "asset_type": "land",
    "name": "Agricultural Land Sivagangai",
    "metadata": {"survey_number": "1199"},
}

_VEHICLE = {
    "asset_type": "vehicle",
    "name": "Honda City TN09AB1234",
    "acquisition_cost": "1450000.00",
    "current_value": "1100000.00",
    "metadata": {"registration_number": "TN09AB1234"},
}

_OTHER = {
    "asset_type": "other",
    "name": "Gold Holdings 50g",
    "current_value": "350000.00",
    "metadata": {},
}


class TestCreateAsset:
    async def test_create_building(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/assets/", headers=auth(user_a), json=_BUILDING)
        assert resp.status_code == 201
        data = resp.json()
        assert data["asset_type"] == "building"
        assert data["name"] == "Chennai Office Building"
        assert data["user_id"] == user_a["id"]
        assert data["is_archived"] is False

    async def test_create_land(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/assets/", headers=auth(user_a), json=_LAND)
        assert resp.status_code == 201
        assert resp.json()["asset_type"] == "land"

    async def test_create_vehicle(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/assets/", headers=auth(user_a), json=_VEHICLE)
        assert resp.status_code == 201
        assert resp.json()["asset_type"] == "vehicle"

    async def test_create_other(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/assets/", headers=auth(user_a), json=_OTHER)
        assert resp.status_code == 201
        assert resp.json()["asset_type"] == "other"

    async def test_requires_auth(self, client: AsyncClient):
        resp = await client.post("/api/v1/assets/", json=_BUILDING)
        assert resp.status_code in (401, 403)

    async def test_invalid_asset_type_returns_422(self, client: AsyncClient, user_a: dict):
        resp = await client.post(
            "/api/v1/assets/",
            headers=auth(user_a),
            json={**_BUILDING, "asset_type": "spaceship"},
        )
        assert resp.status_code == 422

    async def test_missing_name_returns_422(self, client: AsyncClient, user_a: dict):
        payload = {k: v for k, v in _BUILDING.items() if k != "name"}
        resp = await client.post("/api/v1/assets/", headers=auth(user_a), json=payload)
        assert resp.status_code == 422

    async def test_name_too_short_returns_422(self, client: AsyncClient, user_a: dict):
        resp = await client.post(
            "/api/v1/assets/",
            headers=auth(user_a),
            json={**_BUILDING, "name": "X"},  # min_length=2
        )
        assert resp.status_code == 422

    async def test_name_too_long_returns_422(self, client: AsyncClient, user_a: dict):
        resp = await client.post(
            "/api/v1/assets/",
            headers=auth(user_a),
            json={**_BUILDING, "name": "A" * 201},
        )
        assert resp.status_code == 422

    async def test_user_id_is_auto_assigned_from_token(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/assets/", headers=auth(user_a), json=_BUILDING)
        assert resp.json()["user_id"] == user_a["id"]

    async def test_cannot_spoof_user_id_in_body(
        self, client: AsyncClient, user_a: dict, user_b: dict
    ):
        payload = {**_BUILDING, "user_id": user_b["id"]}
        resp = await client.post("/api/v1/assets/", headers=auth(user_a), json=payload)
        if resp.status_code == 201:
            assert resp.json()["user_id"] == user_a["id"]

    async def test_default_status_is_active(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/assets/", headers=auth(user_a), json=_BUILDING)
        assert resp.json()["status"] == "active"


class TestListAssets:
    async def test_returns_paginated_response(
        self, client: AsyncClient, user_a: dict, building: dict
    ):
        resp = await client.get("/api/v1/assets/", headers=auth(user_a))
        assert resp.status_code == 200
        assert_paginated(resp.json(), min_items=1)

    async def test_empty_for_user_with_no_assets(self, client: AsyncClient, user_b: dict):
        resp = await client.get("/api/v1/assets/", headers=auth(user_b))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["items"] == []

    async def test_admin_sees_the_shared_vault(
        self, client: AsyncClient, user_a: dict, user_b: dict, building: dict
    ):
        resp = await client.get("/api/v1/assets/", headers=auth(user_b))
        ids = [i["id"] for i in resp.json()["items"]]
        assert building["id"] in ids

    async def test_filter_by_asset_type(
        self, client: AsyncClient, user_a: dict, building: dict, land: dict
    ):
        resp = await client.get(
            "/api/v1/assets/?asset_type=building", headers=auth(user_a)
        )
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["asset_type"] == "building"

    async def test_filter_by_status_active(
        self, client: AsyncClient, user_a: dict, building: dict
    ):
        resp = await client.get("/api/v1/assets/?status=active", headers=auth(user_a))
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["status"] == "active"

    async def test_archived_assets_excluded_by_default(
        self, client: AsyncClient, user_a: dict, building: dict
    ):
        # Archive it
        await client.delete(f"/api/v1/assets/{building['id']}", headers=auth(user_a))
        resp = await client.get("/api/v1/assets/", headers=auth(user_a))
        ids = [i["id"] for i in resp.json()["items"]]
        assert building["id"] not in ids

    async def test_pagination_skip_and_limit(self, client: AsyncClient, user_a: dict):
        # Create 3 assets
        for i in range(3):
            await client.post(
                "/api/v1/assets/",
                headers=auth(user_a),
                json={**_LAND, "name": f"Pagination Land {i}"},
            )
        resp = await client.get("/api/v1/assets/?skip=0&limit=2", headers=auth(user_a))
        assert resp.status_code == 200
        assert len(resp.json()["items"]) <= 2

    async def test_limit_max_100_enforced(self, client: AsyncClient, user_a: dict):
        resp = await client.get("/api/v1/assets/?limit=500", headers=auth(user_a))
        assert resp.status_code in (200, 422)
        if resp.status_code == 200:
            assert len(resp.json()["items"]) <= 100

    async def test_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/assets/")
        assert resp.status_code in (401, 403)


class TestGetAsset:
    async def test_returns_correct_asset(
        self, client: AsyncClient, user_a: dict, building: dict
    ):
        resp = await client.get(f"/api/v1/assets/{building['id']}", headers=auth(user_a))
        assert resp.status_code == 200
        assert resp.json()["id"] == building["id"]
        assert resp.json()["name"] == building["name"]

    async def test_nonexistent_returns_404(self, client: AsyncClient, user_a: dict):
        resp = await client.get(f"/api/v1/assets/{uuid.uuid4()}", headers=auth(user_a))
        assert resp.status_code == 404

    async def test_admin_can_read_shared_asset(
        self, client: AsyncClient, user_a: dict, user_b: dict, building: dict
    ):
        resp = await client.get(
            f"/api/v1/assets/{building['id']}", headers=auth(user_b)
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == building["id"]

    async def test_invalid_uuid_returns_422(self, client: AsyncClient, user_a: dict):
        resp = await client.get("/api/v1/assets/not-a-uuid", headers=auth(user_a))
        assert resp.status_code == 422

    async def test_requires_auth(self, client: AsyncClient, building: dict):
        resp = await client.get(f"/api/v1/assets/{building['id']}")
        assert resp.status_code in (401, 403)


class TestGetAssetSummary:
    async def test_returns_summary_fields(
        self, client: AsyncClient, user_a: dict, building: dict
    ):
        resp = await client.get(
            f"/api/v1/assets/{building['id']}/summary", headers=auth(user_a)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total_taxes_paid" in data
        assert "total_taxes_pending" in data
        assert "docs_count" in data

    async def test_admin_can_read_shared_summary(
        self, client: AsyncClient, user_a: dict, user_b: dict, building: dict
    ):
        resp = await client.get(
            f"/api/v1/assets/{building['id']}/summary", headers=auth(user_b)
        )
        assert resp.status_code == 200


class TestUpdateAsset:
    async def test_update_name(self, client: AsyncClient, user_a: dict, building: dict):
        resp = await client.patch(
            f"/api/v1/assets/{building['id']}",
            headers=auth(user_a),
            json={"name": "Updated Building Name"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Building Name"

    async def test_update_current_value(
        self, client: AsyncClient, user_a: dict, building: dict
    ):
        resp = await client.patch(
            f"/api/v1/assets/{building['id']}",
            headers=auth(user_a),
            json={"current_value": "10000000.00"},
        )
        assert resp.status_code == 200
        assert float(resp.json()["current_value"]) == 10000000.00

    async def test_update_status(self, client: AsyncClient, user_a: dict, building: dict):
        resp = await client.patch(
            f"/api/v1/assets/{building['id']}",
            headers=auth(user_a),
            json={"status": "sold"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "sold"

    async def test_invalid_status_returns_422(
        self, client: AsyncClient, user_a: dict, building: dict
    ):
        resp = await client.patch(
            f"/api/v1/assets/{building['id']}",
            headers=auth(user_a),
            json={"status": "vaporized"},
        )
        assert resp.status_code == 422

    async def test_admin_cannot_update(
        self, client: AsyncClient, user_a: dict, user_b: dict, building: dict
    ):
        resp = await client.patch(
            f"/api/v1/assets/{building['id']}",
            headers=auth(user_b),
            json={"name": "Changed Name"},
        )
        assert resp.status_code == 403

    async def test_nonexistent_returns_404(self, client: AsyncClient, user_a: dict):
        resp = await client.patch(
            f"/api/v1/assets/{uuid.uuid4()}",
            headers=auth(user_a),
            json={"name": "Ghost"},
        )
        assert resp.status_code == 404


class TestDeleteAsset:
    async def test_archive_returns_200(self, client: AsyncClient, user_a: dict):
        create = await client.post(
            "/api/v1/assets/", headers=auth(user_a), json=_BUILDING
        )
        asset_id = create.json()["id"]
        resp = await client.delete(f"/api/v1/assets/{asset_id}", headers=auth(user_a))
        assert resp.status_code == 200
        assert "detail" in resp.json()

    async def test_get_after_archive_returns_404(self, client: AsyncClient, user_a: dict):
        create = await client.post(
            "/api/v1/assets/", headers=auth(user_a), json=_BUILDING
        )
        asset_id = create.json()["id"]
        await client.delete(f"/api/v1/assets/{asset_id}", headers=auth(user_a))
        get = await client.get(f"/api/v1/assets/{asset_id}", headers=auth(user_a))
        assert get.status_code == 404

    async def test_admin_cannot_archive(
        self, client: AsyncClient, user_a: dict, user_b: dict, building: dict
    ):
        resp = await client.delete(
            f"/api/v1/assets/{building['id']}", headers=auth(user_b)
        )
        assert resp.status_code == 403

    async def test_nonexistent_delete_returns_404(self, client: AsyncClient, user_a: dict):
        resp = await client.delete(
            f"/api/v1/assets/{uuid.uuid4()}", headers=auth(user_a)
        )
        assert resp.status_code == 404

    async def test_requires_auth(self, client: AsyncClient, building: dict):
        resp = await client.delete(f"/api/v1/assets/{building['id']}")
        assert resp.status_code in (401, 403)
