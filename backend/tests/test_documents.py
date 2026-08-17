"""
Document tests — upload-url presign, create, list, search, update, delete, download.

DocumentCategory: income_tax | property | gst | vehicle | insurance | bills | other
R2 client is mocked in the conftest client fixture.
DELETE → 200 (soft delete, is_deleted=True). GET download after → 404.
"""
import uuid

from httpx import AsyncClient

from tests.conftest import assert_paginated, auth

_DOC = {
    "label": "ITR 2025-26",
    "storage_key": "user/library/income_tax/itr_2025.pdf",
    "category": "income_tax",
    "file_name": "itr.pdf",
    "mime_type": "application/pdf",
    "financial_year": "2025-26",
    "tags": ["itr", "income"],
}


class TestUploadUrl:
    async def test_success_returns_upload_url_and_storage_key(
        self, client: AsyncClient, user_a: dict
    ):
        resp = await client.post(
            "/api/v1/documents/upload-url",
            headers=auth(user_a),
            json={
                "file_name": "test.pdf",
                "mime_type": "application/pdf",
                "category": "income_tax",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "upload_url" in data
        assert "storage_key" in data
        assert len(data["upload_url"]) > 0
        assert len(data["storage_key"]) > 0

    async def test_disallowed_mime_type_returns_415(
        self, client: AsyncClient, user_a: dict
    ):
        resp = await client.post(
            "/api/v1/documents/upload-url",
            headers=auth(user_a),
            json={
                "file_name": "test.exe",
                "mime_type": "application/octet-stream",
                "category": "other",
            },
        )
        assert resp.status_code == 415

    async def test_file_too_large_returns_413(
        self, client: AsyncClient, user_a: dict
    ):
        resp = await client.post(
            "/api/v1/documents/upload-url",
            headers=auth(user_a),
            json={
                "file_name": "huge.pdf",
                "mime_type": "application/pdf",
                "file_size_kb": 999999,  # huge file
                "category": "other",
            },
        )
        assert resp.status_code == 413

    async def test_upload_url_linked_to_entity(
        self, client: AsyncClient, user_a: dict, building: dict
    ):
        resp = await client.post(
            "/api/v1/documents/upload-url",
            headers=auth(user_a),
            json={
                "file_name": "deed.pdf",
                "mime_type": "application/pdf",
                "category": "property",
                "entity_type": "asset",
                "entity_id": building["id"],
            },
        )
        assert resp.status_code == 200
        # storage_key should include the entity context
        assert building["id"] in resp.json()["storage_key"]

    async def test_admin_can_upload_against_a_shared_entity(
        self, client: AsyncClient, user_a: dict, user_b: dict, building: dict
    ):
        """The property belongs to the shared vault, so an admin may attach to it."""
        resp = await client.post(
            "/api/v1/documents/upload-url",
            headers=auth(user_b),
            json={
                "file_name": "deed.pdf",
                "mime_type": "application/pdf",
                "category": "property",
                "entity_type": "asset",
                "entity_id": building["id"],
            },
        )
        assert resp.status_code == 200

    async def test_requires_auth(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/documents/upload-url",
            json={"file_name": "x.pdf", "mime_type": "application/pdf"},
        )
        assert resp.status_code in (401, 403)


class TestCreateDocument:
    async def test_success(self, client: AsyncClient, user_a: dict):
        resp = await client.post(
            "/api/v1/documents/", headers=auth(user_a), json=_DOC
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["label"] == "ITR 2025-26"
        assert data["category"] == "income_tax"
        assert data["user_id"] == user_a["id"]
        assert data["is_deleted"] is False

    async def test_missing_label_returns_422(self, client: AsyncClient, user_a: dict):
        payload = {k: v for k, v in _DOC.items() if k != "label"}
        resp = await client.post("/api/v1/documents/", headers=auth(user_a), json=payload)
        assert resp.status_code == 422

    async def test_empty_label_returns_422(self, client: AsyncClient, user_a: dict):
        resp = await client.post(
            "/api/v1/documents/",
            headers=auth(user_a),
            json={**_DOC, "label": ""},
        )
        assert resp.status_code == 422

    async def test_missing_storage_key_returns_422(
        self, client: AsyncClient, user_a: dict
    ):
        payload = {k: v for k, v in _DOC.items() if k != "storage_key"}
        resp = await client.post("/api/v1/documents/", headers=auth(user_a), json=payload)
        assert resp.status_code == 422

    async def test_linked_to_own_asset(
        self, client: AsyncClient, user_a: dict, building: dict
    ):
        resp = await client.post(
            "/api/v1/documents/",
            headers=auth(user_a),
            json={
                **_DOC,
                "entity_type": "asset",
                "entity_id": building["id"],
            },
        )
        assert resp.status_code == 201
        assert resp.json()["entity_id"] == building["id"]

    async def test_admin_can_link_to_a_shared_entity(
        self, client: AsyncClient, user_a: dict, user_b: dict, building: dict
    ):
        resp = await client.post(
            "/api/v1/documents/",
            headers=auth(user_b),
            json={
                **_DOC,
                "entity_type": "asset",
                "entity_id": building["id"],
            },
        )
        assert resp.status_code == 201

    async def test_requires_auth(self, client: AsyncClient):
        resp = await client.post("/api/v1/documents/", json=_DOC)
        assert resp.status_code in (401, 403)


class TestListDocuments:
    async def test_returns_paginated(
        self, client: AsyncClient, user_a: dict, document: dict
    ):
        resp = await client.get("/api/v1/documents/", headers=auth(user_a))
        assert resp.status_code == 200
        assert_paginated(resp.json(), min_items=1)

    async def test_empty_for_new_user(self, client: AsyncClient, user_b: dict):
        resp = await client.get("/api/v1/documents/", headers=auth(user_b))
        assert resp.json()["total"] == 0

    async def test_admin_sees_the_shared_library(
        self, client: AsyncClient, user_a: dict, user_b: dict, document: dict
    ):
        resp = await client.get("/api/v1/documents/", headers=auth(user_b))
        ids = [i["id"] for i in resp.json()["items"]]
        assert document["id"] in ids

    async def test_filter_by_category(
        self, client: AsyncClient, user_a: dict, document: dict
    ):
        resp = await client.get(
            "/api/v1/documents/?category=income_tax", headers=auth(user_a)
        )
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["category"] == "income_tax"

    async def test_deleted_docs_excluded(
        self, client: AsyncClient, user_a: dict, document: dict
    ):
        await client.delete(
            f"/api/v1/documents/{document['id']}", headers=auth(user_a)
        )
        resp = await client.get("/api/v1/documents/", headers=auth(user_a))
        ids = [i["id"] for i in resp.json()["items"]]
        assert document["id"] not in ids

    async def test_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/documents/")
        assert resp.status_code in (401, 403)


class TestSearchDocuments:
    async def test_finds_by_label_substring(
        self, client: AsyncClient, user_a: dict, document: dict
    ):
        resp = await client.get(
            "/api/v1/documents/search?q=ITR", headers=auth(user_a)
        )
        assert resp.status_code == 200
        assert_paginated(resp.json(), min_items=1)
        labels = [i["label"] for i in resp.json()["items"]]
        assert document["label"] in labels

    async def test_no_results_for_unrelated_query(
        self, client: AsyncClient, user_a: dict, document: dict
    ):
        resp = await client.get(
            "/api/v1/documents/search?q=TOTALLY_UNRELATED_XYZ", headers=auth(user_a)
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    async def test_admin_can_search_the_shared_library(
        self, client: AsyncClient, user_a: dict, user_b: dict, document: dict
    ):
        resp = await client.get(
            "/api/v1/documents/search?q=ITR", headers=auth(user_b)
        )
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    async def test_missing_q_param_returns_422(
        self, client: AsyncClient, user_a: dict
    ):
        resp = await client.get("/api/v1/documents/search", headers=auth(user_a))
        assert resp.status_code == 422

    async def test_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/documents/search?q=test")
        assert resp.status_code in (401, 403)


class TestUpdateDocument:
    async def test_update_label(
        self, client: AsyncClient, user_a: dict, document: dict
    ):
        resp = await client.patch(
            f"/api/v1/documents/{document['id']}",
            headers=auth(user_a),
            json={"label": "Updated ITR 2025-26"},
        )
        assert resp.status_code == 200
        assert resp.json()["label"] == "Updated ITR 2025-26"

    async def test_update_tags(
        self, client: AsyncClient, user_a: dict, document: dict
    ):
        resp = await client.patch(
            f"/api/v1/documents/{document['id']}",
            headers=auth(user_a),
            json={"tags": ["itr", "income", "2025"]},
        )
        assert resp.status_code == 200
        assert "itr" in resp.json()["tags"]

    async def test_empty_label_returns_422(
        self, client: AsyncClient, user_a: dict, document: dict
    ):
        resp = await client.patch(
            f"/api/v1/documents/{document['id']}",
            headers=auth(user_a),
            json={"label": ""},
        )
        assert resp.status_code == 422

    async def test_admin_cannot_rename(
        self, client: AsyncClient, user_a: dict, user_b: dict, document: dict
    ):
        resp = await client.patch(
            f"/api/v1/documents/{document['id']}",
            headers=auth(user_b),
            json={"label": "Renamed"},
        )
        assert resp.status_code == 403


class TestDownloadDocument:
    async def test_returns_presigned_download_url(
        self, client: AsyncClient, user_a: dict, document: dict
    ):
        resp = await client.get(
            f"/api/v1/documents/{document['id']}/download",
            headers=auth(user_a),
        )
        assert resp.status_code == 200
        assert "download_url" in resp.json()
        assert len(resp.json()["download_url"]) > 0

    async def test_admin_can_download(
        self, client: AsyncClient, user_a: dict, user_b: dict, document: dict
    ):
        resp = await client.get(
            f"/api/v1/documents/{document['id']}/download",
            headers=auth(user_b),
        )
        assert resp.status_code == 200

    async def test_nonexistent_download_returns_404(
        self, client: AsyncClient, user_a: dict
    ):
        resp = await client.get(
            f"/api/v1/documents/{uuid.uuid4()}/download",
            headers=auth(user_a),
        )
        assert resp.status_code == 404


class TestDeleteDocument:
    async def test_soft_delete_returns_200(
        self, client: AsyncClient, user_a: dict, document: dict
    ):
        resp = await client.delete(
            f"/api/v1/documents/{document['id']}", headers=auth(user_a)
        )
        assert resp.status_code == 200
        assert "detail" in resp.json()

    async def test_download_after_delete_returns_404(
        self, client: AsyncClient, user_a: dict, document: dict
    ):
        await client.delete(f"/api/v1/documents/{document['id']}", headers=auth(user_a))
        resp = await client.get(
            f"/api/v1/documents/{document['id']}/download",
            headers=auth(user_a),
        )
        assert resp.status_code == 404

    async def test_admin_cannot_delete(
        self, client: AsyncClient, user_a: dict, user_b: dict, document: dict
    ):
        resp = await client.delete(
            f"/api/v1/documents/{document['id']}", headers=auth(user_b)
        )
        assert resp.status_code == 403

    async def test_nonexistent_delete_returns_404(
        self, client: AsyncClient, user_a: dict
    ):
        resp = await client.delete(
            f"/api/v1/documents/{uuid.uuid4()}", headers=auth(user_a)
        )
        assert resp.status_code == 404
