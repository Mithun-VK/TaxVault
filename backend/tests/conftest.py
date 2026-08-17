import os
import uuid
from collections.abc import AsyncGenerator
from typing import Any
from unittest.mock import patch

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.db.base import Base

# Import all models to ensure they're registered with Base.metadata
import app.models  # noqa: F401

TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://taxvault:taxvault@localhost:5432/taxvault_test",
)


@pytest_asyncio.fixture
async def engine() -> AsyncGenerator[AsyncEngine, None]:
    eng = create_async_engine(TEST_DB_URL, echo=False, poolclass=NullPool)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    from app.main import app
    from app.core.dependencies import get_db

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    with patch("app.services.document_service._get_r2_client") as mock_r2:
        mock_r2.return_value.generate_presigned_url.return_value = (
            "https://mock-r2.example.com/presigned"
        )
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac

    app.dependency_overrides.clear()


# ── User creation helpers ─────────────────────────────────────────────────────
#
# TaxVault holds one shared vault owned by the earliest-created super admin, and
# the first account to register takes that role. So `user_a` is the vault owner
# and every other account reads the *same* data through a narrower role — what
# differs between fixtures is what they are allowed to do, not what they can see.


async def _create_user(
    client: AsyncClient, email: str, password: str, full_name: str
) -> dict[str, Any]:
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": full_name},
    )
    assert reg.status_code == 201, f"Register failed for {email}: {reg.json()}"
    tokens = reg.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    me = await client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200
    return {
        "id": me.json()["id"],
        "email": email,
        "password": password,
        "full_name": full_name,
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "headers": headers,
    }


async def _set_role(
    client: AsyncClient, owner: dict[str, Any], user: dict[str, Any], role: str
) -> dict[str, Any]:
    """Promote/demote via the API, which only the super admin may call."""
    resp = await client.patch(
        f"/api/v1/users/{user['id']}/role", headers=owner["headers"], json={"role": role}
    )
    assert resp.status_code == 200, f"Role change failed: {resp.json()}"
    user["role"] = role
    return user


@pytest_asyncio.fixture
async def user_a(client: AsyncClient) -> dict[str, Any]:
    """The vault owner — first to register, so `super_admin`: full CRUD."""
    user = await _create_user(client, "user_a@test.com", "Password123!", "User Alpha")
    user["role"] = "super_admin"
    return user


@pytest_asyncio.fixture
async def user_b(client: AsyncClient, user_a: dict) -> dict[str, Any]:
    """A second account with the `admin` role: sees the whole shared vault and
    may add records, but may never edit or delete."""
    user = await _create_user(client, "user_b@test.com", "Password123!", "User Beta")
    return await _set_role(client, user_a, user, "admin")


@pytest_asyncio.fixture
async def member(client: AsyncClient, user_a: dict) -> dict[str, Any]:
    """A `user`-role account: the payables desk. Bills, taxes, insurance,
    payments and the calendar — and it may add bills and log payments."""
    user = await _create_user(client, "member@test.com", "Password123!", "Member Gamma")
    return await _set_role(client, user_a, user, "user")


# Keep legacy fixtures so old-style tests don't break
@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession):
    from app.core.security import hash_password
    from app.models.user import User

    user = User(
        email=f"test_{uuid.uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("password123"),
        full_name="Test User",
        phone_number="+919999999999",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def auth_headers(test_user) -> dict[str, str]:
    from app.core.security import create_access_token

    token = create_access_token(str(test_user.id))
    return {"Authorization": f"Bearer {token}"}


# ── Shared helpers (importable by test modules) ───────────────────────────────

def auth(user: dict) -> dict[str, str]:
    return user["headers"]


def assert_paginated(data: dict, min_items: int = 0) -> None:
    assert "items" in data, f"Missing 'items' in: {data}"
    assert "total" in data, f"Missing 'total' in: {data}"
    assert isinstance(data["items"], list)
    assert isinstance(data["total"], int)
    assert data["total"] >= min_items


# ── Shared entity fixtures ────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def building(client: AsyncClient, user_a: dict) -> dict:
    resp = await client.post(
        "/api/v1/assets/",
        headers=auth(user_a),
        json={"asset_type": "building", "name": "Test Building Chennai", "metadata": {}},
    )
    assert resp.status_code == 201
    return resp.json()


@pytest_asyncio.fixture
async def land(client: AsyncClient, user_a: dict) -> dict:
    resp = await client.post(
        "/api/v1/assets/",
        headers=auth(user_a),
        json={"asset_type": "land", "name": "Test Land Sivagangai", "metadata": {}},
    )
    assert resp.status_code == 201
    return resp.json()


@pytest_asyncio.fixture
async def tax(client: AsyncClient, user_a: dict) -> dict:
    resp = await client.post(
        "/api/v1/taxes/",
        headers=auth(user_a),
        json={
            "tax_type": "property_tax",
            "due_date": "2026-09-30",
            "total_amount": "5000.00",
            "jurisdiction": "Chennai Corporation",
        },
    )
    assert resp.status_code == 201
    return resp.json()


@pytest_asyncio.fixture
async def bill(client: AsyncClient, user_a: dict) -> dict:
    resp = await client.post(
        "/api/v1/bills/",
        headers=auth(user_a),
        json={
            "bill_type": "electricity",
            "provider_name": "TNEB",
            "billing_cycle": "monthly",
            "average_amount": "800.00",
            "next_due_date": "2026-07-10",
        },
    )
    assert resp.status_code == 201
    return resp.json()


@pytest_asyncio.fixture
async def insurance(client: AsyncClient, user_a: dict) -> dict:
    resp = await client.post(
        "/api/v1/insurance/",
        headers=auth(user_a),
        json={
            "policy_number": "LIC-TEST-001",
            "provider_name": "LIC",
            "insurance_type": "life",
            "premium_amount": "12000.00",
            "premium_frequency": "annual",
            "next_premium_date": "2027-01-01",
        },
    )
    assert resp.status_code == 201
    return resp.json()


@pytest_asyncio.fixture
async def document(client: AsyncClient, user_a: dict) -> dict:
    resp = await client.post(
        "/api/v1/documents/",
        headers=auth(user_a),
        json={
            "label": "ITR 2025-26",
            "storage_key": "user/library/income_tax/test_itr.pdf",
            "category": "income_tax",
            "file_name": "itr.pdf",
            "mime_type": "application/pdf",
            "tags": ["itr"],
        },
    )
    assert resp.status_code == 201
    return resp.json()
