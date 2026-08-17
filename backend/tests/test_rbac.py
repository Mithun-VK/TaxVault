"""Role-based access control.

Three roles read one shared vault (owned by the earliest-created super admin)
and differ only in what they may do with it:

    super_admin  full CRUD everywhere + user management
    admin        sees everything, may add records, never edits or deletes
    user         payables desk: calendar, bills, taxes, insurance, payments;
                 may add bills and log payments

`user_a` is the vault owner, `user_b` the admin and `member` the user role —
see conftest.py. The permission table itself lives in app/core/permissions.py.
"""
import pytest
from httpx import AsyncClient

from app.core.permissions import (
    ROLE_ADMIN,
    ROLE_PERMISSIONS,
    ROLE_SUPER_ADMIN,
    ROLE_USER,
    has_permission,
)
from tests.conftest import auth


class TestPermissionTable:
    """Pure-table invariants — no HTTP, so a bad edit fails loudly and fast."""

    def test_super_admin_is_a_superset_of_admin(self):
        assert ROLE_PERMISSIONS[ROLE_ADMIN] < ROLE_PERMISSIONS[ROLE_SUPER_ADMIN]

    def test_super_admin_is_a_superset_of_user(self):
        assert ROLE_PERMISSIONS[ROLE_USER] < ROLE_PERMISSIONS[ROLE_SUPER_ADMIN]

    @pytest.mark.parametrize(
        "permission",
        [
            "properties.edit", "properties.delete",
            "bills.edit", "bills.delete",
            "taxes.edit", "taxes.delete",
            "insurance.edit", "insurance.delete",
            "documents.edit", "documents.delete",
            "individuals.edit", "individuals.delete",
            "payments.edit", "payments.delete",
            "alerts.edit", "users.manage",
        ],
    )
    def test_only_the_super_admin_mutates_or_deletes(self, permission):
        assert has_permission(ROLE_SUPER_ADMIN, permission)
        assert not has_permission(ROLE_ADMIN, permission)
        assert not has_permission(ROLE_USER, permission)

    @pytest.mark.parametrize(
        "permission",
        ["properties.create", "taxes.create", "insurance.create", "bills.create"],
    )
    def test_admin_may_add_the_four_record_types(self, permission):
        assert has_permission(ROLE_ADMIN, permission)

    @pytest.mark.parametrize(
        "permission",
        ["properties.view", "individuals.view", "company.view", "reports.view",
         "analytics.view", "documents.browse"],
    )
    def test_member_is_kept_out_of_the_wider_vault(self, permission):
        assert has_permission(ROLE_ADMIN, permission)
        assert not has_permission(ROLE_USER, permission)

    def test_member_adds_payables_but_not_the_wider_vault(self):
        creatable = {p for p in ROLE_PERMISSIONS[ROLE_USER] if p.endswith(".create")}
        assert creatable == {
            "bills.create",
            "taxes.create",
            "insurance.create",
            "payments.create",
            "documents.create",
        }

    def test_members_edits_go_through_approval(self):
        """A member never edits directly; they hold request_change instead."""
        for resource in ("bills", "taxes", "insurance"):
            assert has_permission(ROLE_USER, f"{resource}.request_change")
            assert not has_permission(ROLE_USER, f"{resource}.edit")
            assert not has_permission(ROLE_USER, f"{resource}.delete")

    def test_only_admins_and_above_review_requests(self):
        assert has_permission(ROLE_SUPER_ADMIN, "change_requests.review")
        assert has_permission(ROLE_ADMIN, "change_requests.review")
        assert not has_permission(ROLE_USER, "change_requests.review")

    def test_admin_cannot_file_a_request_it_could_approve(self):
        """The admin is the checker, never the maker — otherwise it could file
        and approve its own edit, which its role otherwise forbids."""
        for resource in ("bills", "taxes", "insurance"):
            assert has_permission(ROLE_ADMIN, f"{resource}.request_change") is False

    def test_unknown_role_gets_nothing(self):
        assert not has_permission("auditor", "bills.view")
        assert not has_permission(None, "bills.view")


class TestRoleBootstrap:
    async def test_first_account_becomes_the_super_admin(
        self, client: AsyncClient, user_a: dict
    ):
        resp = await client.get("/api/v1/users/me", headers=auth(user_a))
        assert resp.json()["role"] == ROLE_SUPER_ADMIN

    async def test_later_accounts_default_to_member(self, client: AsyncClient, user_a: dict):
        reg = await client.post(
            "/api/v1/auth/register",
            json={"email": "later@test.com", "password": "Password123!", "full_name": "Later"},
        )
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        me = await client.get("/api/v1/users/me", headers=headers)
        assert me.json()["role"] == ROLE_USER


class TestMemberVisibility:
    """A member sees the payables desk and nothing beyond it."""

    @pytest.mark.parametrize(
        "path",
        [
            "/api/v1/bills/",
            "/api/v1/taxes/",
            "/api/v1/insurance/",
            "/api/v1/payments/",
            "/api/v1/dashboard/summary",
            "/api/v1/dashboard/calendar-year?year=2026",
        ],
    )
    async def test_member_can_read_the_payables_desk(
        self, client: AsyncClient, member: dict, path: str
    ):
        resp = await client.get(path, headers=auth(member))
        assert resp.status_code == 200

    @pytest.mark.parametrize(
        "path",
        [
            "/api/v1/assets/",
            "/api/v1/individuals/",
            "/api/v1/reports/assets",
            "/api/v1/reports/payables?type=bill",
            "/api/v1/documents/search?q=deed",
            "/api/v1/gold-categories/",
            "/api/v1/users/",
        ],
    )
    async def test_member_is_refused_everything_else(
        self, client: AsyncClient, member: dict, path: str
    ):
        resp = await client.get(path, headers=auth(member))
        assert resp.status_code == 403

    async def test_member_sees_the_shared_bills(
        self, client: AsyncClient, member: dict, bill: dict
    ):
        """Refused a wider view, but the bills they do see are the real vault's."""
        resp = await client.get("/api/v1/bills/", headers=auth(member))
        assert bill["id"] in [b["id"] for b in resp.json()["items"]]


class TestMemberWrites:
    async def test_member_can_add_a_bill(self, client: AsyncClient, member: dict):
        resp = await client.post(
            "/api/v1/bills/",
            headers=auth(member),
            json={
                "bill_type": "electricity",
                "provider_name": "TNEB",
                "billing_cycle": "monthly",
                "average_amount": "950.00",
                "next_due_date": "2026-08-10",
            },
        )
        assert resp.status_code == 201

    async def test_member_can_log_a_payment(
        self, client: AsyncClient, member: dict, bill: dict
    ):
        resp = await client.post(
            f"/api/v1/bills/{bill['id']}/pay",
            headers=auth(member),
            json={"amount_paid": "800.00", "payment_date": "2026-07-10"},
        )
        assert resp.status_code == 200

    async def test_member_cannot_edit_a_bill(
        self, client: AsyncClient, member: dict, bill: dict
    ):
        resp = await client.patch(
            f"/api/v1/bills/{bill['id']}",
            headers=auth(member),
            json={"provider_name": "Changed"},
        )
        assert resp.status_code == 403

    async def test_member_can_add_a_tax(self, client: AsyncClient, member: dict):
        resp = await client.post(
            "/api/v1/taxes/",
            headers=auth(member),
            json={
                "tax_type": "property_tax",
                "due_date": "2026-09-30",
                "total_amount": "5000.00",
                "jurisdiction": "Chennai",
            },
        )
        assert resp.status_code == 201

    async def test_member_can_add_an_insurance_policy(
        self, client: AsyncClient, member: dict
    ):
        resp = await client.post(
            "/api/v1/insurance/",
            headers=auth(member),
            json={
                "policy_number": "LIC-RBAC-1",
                "provider_name": "LIC",
                "insurance_type": "life",
                "premium_amount": "12000.00",
                "premium_frequency": "annual",
                "next_premium_date": "2027-01-01",
            },
        )
        assert resp.status_code == 201

    @pytest.mark.parametrize(
        ("path", "payload"),
        [
            ("/api/v1/assets/", {"asset_type": "vehicle", "name": "Car", "metadata": {}}),
            ("/api/v1/individuals/", {"full_name": "Someone"}),
        ],
    )
    async def test_member_cannot_add_beyond_the_payables_desk(
        self, client: AsyncClient, member: dict, path: str, payload: dict
    ):
        resp = await client.post(path, headers=auth(member), json=payload)
        assert resp.status_code == 403


class TestAdminWrites:
    """The admin's defining trait: may add, may never change."""

    async def test_admin_can_add_a_property(self, client: AsyncClient, user_b: dict):
        resp = await client.post(
            "/api/v1/assets/",
            headers=auth(user_b),
            json={"asset_type": "vehicle", "name": "Admin's Car", "metadata": {}},
        )
        assert resp.status_code == 201

    async def test_admin_can_add_an_individual(self, client: AsyncClient, user_b: dict):
        resp = await client.post(
            "/api/v1/individuals/", headers=auth(user_b), json={"full_name": "New Person"}
        )
        assert resp.status_code == 201

    async def test_admin_can_add_a_gold_category(self, client: AsyncClient, user_b: dict):
        resp = await client.post(
            "/api/v1/gold-categories/",
            headers=auth(user_b),
            json={"value": "kolusu", "label": "Kolusu"},
        )
        assert resp.status_code == 201

    async def test_admin_can_read_reports(self, client: AsyncClient, user_b: dict):
        resp = await client.get("/api/v1/reports/assets", headers=auth(user_b))
        assert resp.status_code == 200

    async def test_admin_cannot_manage_users(self, client: AsyncClient, user_b: dict):
        resp = await client.get("/api/v1/users/", headers=auth(user_b))
        assert resp.status_code == 403

    async def test_admin_cannot_change_roles(
        self, client: AsyncClient, user_b: dict, member: dict
    ):
        resp = await client.patch(
            f"/api/v1/users/{member['id']}/role",
            headers=auth(user_b),
            json={"role": ROLE_SUPER_ADMIN},
        )
        assert resp.status_code == 403


class TestSuperAdminPowers:
    async def test_super_admin_can_edit_and_delete(
        self, client: AsyncClient, user_a: dict, building: dict
    ):
        patched = await client.patch(
            f"/api/v1/assets/{building['id']}",
            headers=auth(user_a),
            json={"name": "Renamed Building"},
        )
        assert patched.status_code == 200
        deleted = await client.delete(
            f"/api/v1/assets/{building['id']}", headers=auth(user_a)
        )
        assert deleted.status_code == 200

    async def test_super_admin_can_list_and_change_roles(
        self, client: AsyncClient, user_a: dict, member: dict
    ):
        listed = await client.get("/api/v1/users/", headers=auth(user_a))
        assert listed.status_code == 200

        promoted = await client.patch(
            f"/api/v1/users/{member['id']}/role",
            headers=auth(user_a),
            json={"role": ROLE_ADMIN},
        )
        assert promoted.status_code == 200
        assert promoted.json()["role"] == ROLE_ADMIN

    async def test_cannot_demote_the_last_super_admin(
        self, client: AsyncClient, user_a: dict
    ):
        """The vault must never lose its owner."""
        resp = await client.patch(
            f"/api/v1/users/{user_a['id']}/role",
            headers=auth(user_a),
            json={"role": ROLE_ADMIN},
        )
        assert resp.status_code == 403

    async def test_a_promoted_member_gains_the_role_immediately(
        self, client: AsyncClient, user_a: dict, member: dict
    ):
        before = await client.get("/api/v1/assets/", headers=auth(member))
        assert before.status_code == 403

        await client.patch(
            f"/api/v1/users/{member['id']}/role",
            headers=auth(user_a),
            json={"role": ROLE_ADMIN},
        )

        after = await client.get("/api/v1/assets/", headers=auth(member))
        assert after.status_code == 200


class TestSharedVault:
    async def test_all_three_roles_read_one_vault(
        self, client: AsyncClient, user_a: dict, user_b: dict, member: dict, bill: dict
    ):
        for actor in (user_a, user_b, member):
            resp = await client.get("/api/v1/bills/", headers=auth(actor))
            assert resp.status_code == 200, actor["email"]
            assert bill["id"] in [b["id"] for b in resp.json()["items"]]

    async def test_records_added_by_an_admin_land_in_the_owners_vault(
        self, client: AsyncClient, user_a: dict, user_b: dict
    ):
        created = await client.post(
            "/api/v1/assets/",
            headers=auth(user_b),
            json={"asset_type": "vehicle", "name": "Shared Car", "metadata": {}},
        )
        assert created.status_code == 201
        assert created.json()["user_id"] == user_a["id"]

        owner_view = await client.get("/api/v1/assets/", headers=auth(user_a))
        assert created.json()["id"] in [a["id"] for a in owner_view.json()["items"]]
