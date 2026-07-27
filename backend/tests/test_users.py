"""
User profile and password management tests.

PATCH /users/me          → 200, returns updated UserOut
PATCH /users/me/password → 200, returns {"detail": ...}
GET   /users/me          → 200, returns UserOut

PasswordChange schema has: current_password, new_password (no confirm_password).
"""
import pytest
from httpx import AsyncClient

from tests.conftest import auth


class TestGetProfile:
    async def test_returns_own_profile(self, client: AsyncClient, user_a: dict):
        resp = await client.get("/api/v1/users/me", headers=auth(user_a))
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == user_a["email"]
        assert data["full_name"] == user_a["full_name"]
        assert "id" in data
        assert "is_active" in data

    async def test_never_returns_password(self, client: AsyncClient, user_a: dict):
        resp = await client.get("/api/v1/users/me", headers=auth(user_a))
        assert resp.status_code == 200
        body = resp.text
        assert "hashed_password" not in body
        assert "password" not in body

    async def test_unauthenticated_returns_401(self, client: AsyncClient):
        resp = await client.get("/api/v1/users/me")
        assert resp.status_code in (401, 403)

    async def test_user_a_profile_is_isolated_from_user_b(
        self, client: AsyncClient, user_a: dict, user_b: dict
    ):
        ra = await client.get("/api/v1/users/me", headers=auth(user_a))
        rb = await client.get("/api/v1/users/me", headers=auth(user_b))
        assert ra.json()["email"] == user_a["email"]
        assert rb.json()["email"] == user_b["email"]
        assert ra.json()["id"] != rb.json()["id"]


class TestUpdateProfile:
    async def test_update_full_name(self, client: AsyncClient, user_a: dict):
        resp = await client.patch(
            "/api/v1/users/me", headers=auth(user_a), json={"full_name": "Updated Name"}
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Updated Name"

    async def test_update_phone_number(self, client: AsyncClient, user_a: dict):
        resp = await client.patch(
            "/api/v1/users/me",
            headers=auth(user_a),
            json={"phone_number": "+919123456789"},
        )
        assert resp.status_code == 200
        assert resp.json()["phone_number"] == "+919123456789"

    async def test_empty_body_returns_200_no_change(self, client: AsyncClient, user_a: dict):
        """PATCH with no fields is a valid no-op."""
        resp = await client.patch("/api/v1/users/me", headers=auth(user_a), json={})
        assert resp.status_code == 200

    async def test_update_preserves_other_fields(self, client: AsyncClient, user_a: dict):
        """Updating name must not wipe phone or email."""
        resp = await client.patch(
            "/api/v1/users/me", headers=auth(user_a), json={"full_name": "New Name Only"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == user_a["email"]
        assert data["full_name"] == "New Name Only"

    async def test_cannot_change_email_via_patch(self, client: AsyncClient, user_a: dict):
        """email is not part of UserUpdate schema, so it should be ignored or rejected."""
        resp = await client.patch(
            "/api/v1/users/me",
            headers=auth(user_a),
            json={"email": "hacked@hacker.com"},
        )
        # Either 422 (field not accepted) or 200 with original email
        if resp.status_code == 200:
            assert resp.json()["email"] == user_a["email"]

    async def test_response_never_returns_password(self, client: AsyncClient, user_a: dict):
        resp = await client.patch(
            "/api/v1/users/me", headers=auth(user_a), json={"full_name": "Safe"}
        )
        assert "hashed_password" not in resp.text
        assert "password" not in resp.text

    async def test_unauthenticated_returns_401(self, client: AsyncClient):
        resp = await client.patch("/api/v1/users/me", json={"full_name": "X"})
        assert resp.status_code in (401, 403)


class TestChangePassword:
    async def test_success_returns_200(self, client: AsyncClient, user_a: dict):
        resp = await client.patch(
            "/api/v1/users/me/password",
            headers=auth(user_a),
            json={
                "current_password": user_a["password"],
                "new_password": "NewPassword456!",
            },
        )
        assert resp.status_code == 200
        assert "detail" in resp.json()

    async def test_new_password_works_for_login(self, client: AsyncClient, user_a: dict):
        await client.patch(
            "/api/v1/users/me/password",
            headers=auth(user_a),
            json={
                "current_password": user_a["password"],
                "new_password": "NewPassword456!",
            },
        )
        login = await client.post("/api/v1/auth/login", json={
            "email": user_a["email"],
            "password": "NewPassword456!",
        })
        assert login.status_code == 200

    async def test_old_password_rejected_after_change(self, client: AsyncClient, user_a: dict):
        await client.patch(
            "/api/v1/users/me/password",
            headers=auth(user_a),
            json={
                "current_password": user_a["password"],
                "new_password": "NewPassword456!",
            },
        )
        old_login = await client.post("/api/v1/auth/login", json={
            "email": user_a["email"],
            "password": user_a["password"],
        })
        assert old_login.status_code == 401

    async def test_wrong_current_password_returns_401(self, client: AsyncClient, user_a: dict):
        resp = await client.patch(
            "/api/v1/users/me/password",
            headers=auth(user_a),
            json={
                "current_password": "WrongCurrent999!",
                "new_password": "NewPassword456!",
            },
        )
        assert resp.status_code in (400, 401)

    async def test_missing_current_password_returns_422(self, client: AsyncClient, user_a: dict):
        resp = await client.patch(
            "/api/v1/users/me/password",
            headers=auth(user_a),
            json={"new_password": "NewPassword456!"},
        )
        assert resp.status_code == 422

    async def test_missing_new_password_returns_422(self, client: AsyncClient, user_a: dict):
        resp = await client.patch(
            "/api/v1/users/me/password",
            headers=auth(user_a),
            json={"current_password": user_a["password"]},
        )
        assert resp.status_code == 422

    async def test_unauthenticated_returns_401(self, client: AsyncClient):
        resp = await client.patch(
            "/api/v1/users/me/password",
            json={"current_password": "x", "new_password": "y"},
        )
        assert resp.status_code in (401, 403)
