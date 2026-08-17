"""
Comprehensive auth tests — every endpoint, every edge case.

API facts:
  POST /auth/register  → 201, returns {access_token, refresh_token, token_type}
  POST /auth/login     → 200, returns same
  POST /auth/refresh   → 200, returns same
  POST /auth/logout    → 204, NO auth required, silently ignores bad tokens
  POST /auth/forgot-password  → 200 always (no email enumeration)
  POST /auth/reset-password   → 200 on success, 401 on bad token

Validation error shape:  {"detail": "Validation error", "errors": [...]}
"""
import uuid

import pytest
from freezegun import freeze_time
from httpx import AsyncClient

from tests.conftest import auth


# ── Register ──────────────────────────────────────────────────────────────────

class TestRegister:
    async def test_success_returns_tokens(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/register", json={
            "email": "newuser@test.com",
            "password": "Password123!",
            "full_name": "New User",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 20
        assert len(data["refresh_token"]) > 20

    async def test_success_no_password_in_response(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/register", json={
            "email": "secure@test.com",
            "password": "Password123!",
            "full_name": "Secure User",
        })
        assert resp.status_code == 201
        body = resp.text
        assert "Password123!" not in body
        assert "hashed_password" not in body
        assert "bcrypt" not in body

    async def test_duplicate_email_returns_409(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/auth/register", json={
            "email": user_a["email"],
            "password": "Password123!",
            "full_name": "Dup",
        })
        assert resp.status_code == 409
        assert "detail" in resp.json()

    async def test_invalid_email_returns_422(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/register", json={
            "email": "not-an-email",
            "password": "Password123!",
            "full_name": "Test",
        })
        assert resp.status_code == 422

    async def test_missing_email_returns_422(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/register", json={
            "password": "Password123!",
        })
        assert resp.status_code == 422

    async def test_missing_password_returns_422(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/register", json={
            "email": "nopass@test.com",
        })
        assert resp.status_code == 422

    async def test_empty_body_returns_422(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/register", json={})
        assert resp.status_code == 422

    async def test_sql_injection_email_is_safe(self, client: AsyncClient):
        """SQL injection in email must not cause a 500 — validation rejects it."""
        resp = await client.post("/api/v1/auth/register", json={
            "email": "'; DROP TABLE users; --@evil.com",
            "password": "Password123!",
            "full_name": "Hacker",
        })
        assert resp.status_code == 422
        assert resp.status_code != 500

    async def test_xss_in_full_name_is_stored_safely(self, client: AsyncClient):
        """XSS payload in full_name must be stored as-is (sanitised at render), not crash."""
        resp = await client.post("/api/v1/auth/register", json={
            "email": "xss@test.com",
            "password": "Password123!",
            "full_name": "<script>alert(1)</script>",
        })
        assert resp.status_code == 201

    async def test_phone_number_accepted_as_optional(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/register", json={
            "email": "withphone@test.com",
            "password": "Password123!",
            "full_name": "Phone User",
            "phone_number": "+919876543210",
        })
        assert resp.status_code == 201

    async def test_returned_token_authenticates_user(self, client: AsyncClient):
        """The access token from register should immediately authenticate /users/me."""
        reg = await client.post("/api/v1/auth/register", json={
            "email": "tokentest@test.com",
            "password": "Password123!",
            "full_name": "Token Test",
        })
        assert reg.status_code == 201
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        me = await client.get("/api/v1/users/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["email"] == "tokentest@test.com"


# ── Login ─────────────────────────────────────────────────────────────────────

class TestLogin:
    async def test_success_returns_tokens(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/auth/login", json={
            "email": user_a["email"],
            "password": user_a["password"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_wrong_password_returns_401(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/auth/login", json={
            "email": user_a["email"],
            "password": "WrongPassword999!",
        })
        assert resp.status_code == 401
        assert "detail" in resp.json()

    async def test_nonexistent_email_returns_401(self, client: AsyncClient):
        """Non-existent email must return 401, not 404 (no account enumeration)."""
        resp = await client.post("/api/v1/auth/login", json={
            "email": "nobody@nowhere.com",
            "password": "Password123!",
        })
        assert resp.status_code == 401

    async def test_empty_body_returns_422(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/login", json={})
        assert resp.status_code == 422

    async def test_missing_password_returns_422(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/login", json={"email": "a@b.com"})
        assert resp.status_code == 422

    async def test_no_password_leak_in_response(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/auth/login", json={
            "email": user_a["email"],
            "password": user_a["password"],
        })
        body = resp.text
        assert user_a["password"] not in body
        assert "hashed_password" not in body

    async def test_returns_new_tokens_each_login(self, client: AsyncClient, user_a: dict):
        """Two logins should produce different tokens."""
        r1 = await client.post("/api/v1/auth/login", json={
            "email": user_a["email"], "password": user_a["password"],
        })
        r2 = await client.post("/api/v1/auth/login", json={
            "email": user_a["email"], "password": user_a["password"],
        })
        # Refresh tokens include a jti so must differ
        assert r1.json()["refresh_token"] != r2.json()["refresh_token"]


# ── Refresh token ─────────────────────────────────────────────────────────────

class TestRefresh:
    async def test_valid_refresh_returns_new_tokens(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": user_a["refresh_token"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

    async def test_garbage_token_returns_401(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": "this.is.garbage",
        })
        assert resp.status_code == 401

    async def test_access_token_used_as_refresh_returns_401(
        self, client: AsyncClient, user_a: dict
    ):
        """Token type guard: access token must not work as refresh token."""
        resp = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": user_a["access_token"],  # wrong type
        })
        assert resp.status_code == 401

    @freeze_time("2030-01-01")
    async def test_expired_refresh_returns_401(self, client: AsyncClient, user_a: dict):
        """Tokens minted in the past are expired when time jumps to 2030."""
        resp = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": user_a["refresh_token"],
        })
        assert resp.status_code == 401

    async def test_missing_token_returns_422(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/refresh", json={})
        assert resp.status_code == 422


# ── Logout ────────────────────────────────────────────────────────────────────

class TestLogout:
    async def test_valid_logout_returns_204(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/auth/logout", json={
            "refresh_token": user_a["refresh_token"],
        })
        assert resp.status_code == 204

    async def test_logout_no_auth_header_required(self, client: AsyncClient, user_a: dict):
        """Logout endpoint does not require Authorization header."""
        resp = await client.post("/api/v1/auth/logout", json={
            "refresh_token": user_a["refresh_token"],
        })
        assert resp.status_code == 204

    async def test_logout_bad_token_silently_succeeds(self, client: AsyncClient):
        """Logout with a garbage token must return 204, not error (fail-safe)."""
        resp = await client.post("/api/v1/auth/logout", json={
            "refresh_token": "garbage.token.here",
        })
        assert resp.status_code == 204

    async def test_missing_token_returns_422(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/logout", json={})
        assert resp.status_code == 422


# ── Forgot password ───────────────────────────────────────────────────────────

class TestForgotPassword:
    async def test_known_email_returns_200(self, client: AsyncClient, user_a: dict):
        resp = await client.post("/api/v1/auth/forgot-password", json={
            "email": user_a["email"],
        })
        assert resp.status_code == 200
        assert "detail" in resp.json()

    async def test_unknown_email_also_returns_200(self, client: AsyncClient):
        """Must never reveal whether an email is registered."""
        resp = await client.post("/api/v1/auth/forgot-password", json={
            "email": "nobody@nowhere.com",
        })
        assert resp.status_code == 200

    async def test_same_response_shape_for_known_and_unknown(
        self, client: AsyncClient, user_a: dict
    ):
        r_known = await client.post("/api/v1/auth/forgot-password", json={
            "email": user_a["email"],
        })
        r_unknown = await client.post("/api/v1/auth/forgot-password", json={
            "email": "nobody@nowhere.com",
        })
        assert r_known.status_code == r_unknown.status_code == 200
        assert set(r_known.json().keys()) == set(r_unknown.json().keys())

    async def test_invalid_email_format_returns_422(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/forgot-password", json={
            "email": "not-an-email",
        })
        assert resp.status_code == 422

    async def test_missing_email_returns_422(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/forgot-password", json={})
        assert resp.status_code == 422


# ── Reset password ────────────────────────────────────────────────────────────

class TestResetPassword:
    async def test_valid_token_changes_password(self, client: AsyncClient, user_a: dict):
        from app.core.security import create_reset_token, decode_token

        # Get user_id from access token
        payload = decode_token(user_a["access_token"])
        reset_token = create_reset_token(payload["sub"])

        resp = await client.post("/api/v1/auth/reset-password", json={
            "token": reset_token,
            "new_password": "NewPassword456!",
        })
        assert resp.status_code == 200
        assert "detail" in resp.json()

        # Old password must be rejected
        bad = await client.post("/api/v1/auth/login", json={
            "email": user_a["email"],
            "password": user_a["password"],
        })
        assert bad.status_code == 401

        # New password must work
        good = await client.post("/api/v1/auth/login", json={
            "email": user_a["email"],
            "password": "NewPassword456!",
        })
        assert good.status_code == 200

    async def test_garbage_token_returns_401(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/reset-password", json={
            "token": "this.is.not.valid",
            "new_password": "NewPassword456!",
        })
        assert resp.status_code == 401

    async def test_access_token_as_reset_returns_401(
        self, client: AsyncClient, user_a: dict
    ):
        """Access token must not be accepted as reset token (wrong type claim)."""
        resp = await client.post("/api/v1/auth/reset-password", json={
            "token": user_a["access_token"],
            "new_password": "NewPassword456!",
        })
        assert resp.status_code == 401

    async def test_missing_token_returns_422(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/reset-password", json={
            "new_password": "NewPassword456!",
        })
        assert resp.status_code == 422

    async def test_missing_new_password_returns_422(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/reset-password", json={
            "token": "sometoken",
        })
        assert resp.status_code == 422

    async def test_used_access_token_as_reset_fails(
        self, client: AsyncClient, user_a: dict
    ):
        """Using a refresh token as reset token returns 401 (wrong type field)."""
        resp = await client.post("/api/v1/auth/reset-password", json={
            "token": user_a["refresh_token"],
            "new_password": "NewPassword456!",
        })
        assert resp.status_code == 401


# ── JWT security ──────────────────────────────────────────────────────────────

class TestJWTSecurity:
    PROTECTED = [
        ("GET", "/api/v1/assets/"),
        ("GET", "/api/v1/taxes/"),
        ("GET", "/api/v1/bills/"),
        ("GET", "/api/v1/insurance/"),
        ("GET", "/api/v1/payments/"),
        ("GET", "/api/v1/documents/"),
        ("GET", "/api/v1/alerts/configs"),
        ("GET", "/api/v1/dashboard/summary"),
        ("GET", "/api/v1/users/me"),
    ]

    async def test_no_token_returns_4xx_for_all_protected_routes(
        self, client: AsyncClient
    ):
        # HTTPBearer(auto_error=True) returns 403 on missing header; a valid
        # but bad token triggers our AuthenticationError handler → 401.
        # Both mean "not authenticated", so we accept either.
        for method, path in self.PROTECTED:
            resp = await client.request(method, path)
            assert resp.status_code in (401, 403), (
                f"{method} {path} → expected 401/403 without auth, got {resp.status_code}"
            )

    async def test_malformed_bearer_returns_401(self, client: AsyncClient):
        resp = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer this.is.not.valid.jwt"},
        )
        assert resp.status_code == 401

    async def test_basic_scheme_returns_4xx(self, client: AsyncClient):
        # HTTPBearer rejects non-Bearer schemes with 403
        resp = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": "Basic dXNlcjpwYXNz"},
        )
        assert resp.status_code in (401, 403)

    async def test_empty_bearer_returns_4xx(self, client: AsyncClient):
        resp = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer "},
        )
        assert resp.status_code in (401, 403)

    async def test_tampered_signature_returns_401(
        self, client: AsyncClient, user_a: dict
    ):
        token = user_a["access_token"]
        parts = token.split(".")
        # Flip last char of signature
        sig = parts[2]
        parts[2] = sig[:-1] + ("B" if sig[-1] != "B" else "A")
        tampered = ".".join(parts)
        resp = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {tampered}"},
        )
        assert resp.status_code == 401

    async def test_valid_token_authenticates(self, client: AsyncClient, user_a: dict):
        resp = await client.get("/api/v1/users/me", headers=auth(user_a))
        assert resp.status_code == 200

    async def test_second_account_reads_the_same_vault(
        self, client: AsyncClient, user_a: dict, user_b: dict, building: dict
    ):
        """Accounts share one vault; the role, not the token, limits what they
        may do with it (see test_rbac.py)."""
        resp = await client.get(
            f"/api/v1/assets/{building['id']}",
            headers=auth(user_b),
        )
        assert resp.status_code == 200
