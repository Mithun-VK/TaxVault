"""The maker/checker queue.

A member adds bills, taxes and insurance policies outright, but an edit or a
delete is filed as a change request and only lands once an admin or super admin
approves it. `member` files, `user_b` (admin) and `user_a` (super admin) review.
"""
from httpx import AsyncClient

from tests.conftest import auth


async def _backdate(db_session, request_id: str) -> None:
    """Push a request's deadline into the past, so the next read lapses it.

    Beats waiting out the real TTL, and exercises the same sweep the service
    runs in production rather than a test-only shortcut.
    """
    from sqlalchemy import text

    await db_session.execute(
        text("UPDATE change_requests SET expires_at = now() - INTERVAL '1 minute' WHERE id = :id"),
        {"id": request_id},
    )
    await db_session.commit()


async def _file_update(
    client: AsyncClient, actor: dict, bill: dict, **payload
) -> dict:
    resp = await client.post(
        "/api/v1/change-requests/",
        headers=auth(actor),
        json={
            "entity_type": "bill",
            "entity_id": bill["id"],
            "action": "update",
            "payload": payload or {"provider_name": "TNEB South"},
            "reason": "Provider renamed on the latest statement",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


class TestFiling:
    async def test_member_files_an_update_request(
        self, client: AsyncClient, member: dict, bill: dict
    ):
        req = await _file_update(client, member, bill)
        assert req["status"] == "pending"
        assert req["action"] == "update"
        assert req["requested_by_id"] == member["id"]
        # The queue reads as a name, not a bare UUID.
        assert req["entity_label"]

    async def test_filing_does_not_change_the_record(
        self, client: AsyncClient, member: dict, bill: dict
    ):
        await _file_update(client, member, bill)
        after = await client.get(f"/api/v1/bills/{bill['id']}", headers=auth(member))
        assert after.json()["provider_name"] == bill["provider_name"]

    async def test_member_files_a_delete_request(
        self, client: AsyncClient, member: dict, bill: dict
    ):
        resp = await client.post(
            "/api/v1/change-requests/",
            headers=auth(member),
            json={"entity_type": "bill", "entity_id": bill["id"], "action": "delete"},
        )
        assert resp.status_code == 201
        assert resp.json()["action"] == "delete"

    async def test_delete_request_rejects_a_payload(
        self, client: AsyncClient, member: dict, bill: dict
    ):
        resp = await client.post(
            "/api/v1/change-requests/",
            headers=auth(member),
            json={
                "entity_type": "bill",
                "entity_id": bill["id"],
                "action": "delete",
                "payload": {"provider_name": "Sneaky"},
            },
        )
        assert resp.status_code == 400

    async def test_invalid_payload_is_refused_at_filing_time(
        self, client: AsyncClient, member: dict, bill: dict
    ):
        """Validated when filed, so a reviewer never approves something that
        would fail on apply."""
        resp = await client.post(
            "/api/v1/change-requests/",
            headers=auth(member),
            json={
                "entity_type": "bill",
                "entity_id": bill["id"],
                "action": "update",
                "payload": {"average_amount": "not-a-number"},
            },
        )
        assert resp.status_code == 422

    async def test_empty_update_is_refused(
        self, client: AsyncClient, member: dict, bill: dict
    ):
        resp = await client.post(
            "/api/v1/change-requests/",
            headers=auth(member),
            json={
                "entity_type": "bill",
                "entity_id": bill["id"],
                "action": "update",
                "payload": {},
            },
        )
        assert resp.status_code == 400

    async def test_unknown_entity_returns_404(
        self, client: AsyncClient, member: dict
    ):
        resp = await client.post(
            "/api/v1/change-requests/",
            headers=auth(member),
            json={
                "entity_type": "bill",
                "entity_id": "00000000-0000-0000-0000-000000000000",
                "action": "delete",
            },
        )
        assert resp.status_code == 404

    async def test_admin_cannot_file_a_request(
        self, client: AsyncClient, user_b: dict, bill: dict
    ):
        """The admin is the checker, never the maker: filing here and approving
        it themselves would sidestep the control entirely. (A super admin may
        file one - but they can already edit directly, so it grants nothing.)"""
        resp = await client.post(
            "/api/v1/change-requests/",
            headers=auth(user_b),
            json={"entity_type": "bill", "entity_id": bill["id"], "action": "delete"},
        )
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(self, client: AsyncClient):
        resp = await client.get("/api/v1/change-requests/")
        assert resp.status_code in (401, 403)


class TestApproval:
    async def test_admin_approval_applies_the_update(
        self, client: AsyncClient, user_b: dict, member: dict, bill: dict
    ):
        req = await _file_update(client, member, bill, provider_name="TNEB South")

        approved = await client.post(
            f"/api/v1/change-requests/{req['id']}/approve",
            headers=auth(user_b),
            json={"note": "Confirmed against the statement"},
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "approved"
        assert approved.json()["reviewed_by_id"] == user_b["id"]

        after = await client.get(f"/api/v1/bills/{bill['id']}", headers=auth(member))
        assert after.json()["provider_name"] == "TNEB South"

    async def test_super_admin_can_approve(
        self, client: AsyncClient, user_a: dict, member: dict, bill: dict
    ):
        req = await _file_update(client, member, bill, provider_name="TNEB North")
        approved = await client.post(
            f"/api/v1/change-requests/{req['id']}/approve", headers=auth(user_a)
        )
        assert approved.status_code == 200

    async def test_approving_a_delete_removes_the_record(
        self, client: AsyncClient, user_b: dict, member: dict, bill: dict
    ):
        filed = await client.post(
            "/api/v1/change-requests/",
            headers=auth(member),
            json={"entity_type": "bill", "entity_id": bill["id"], "action": "delete"},
        )
        approved = await client.post(
            f"/api/v1/change-requests/{filed.json()['id']}/approve", headers=auth(user_b)
        )
        assert approved.status_code == 200

        after = await client.get(f"/api/v1/bills/{bill['id']}", headers=auth(member))
        assert after.json()["is_active"] is False

    async def test_rejection_leaves_the_record_alone(
        self, client: AsyncClient, user_b: dict, member: dict, bill: dict
    ):
        req = await _file_update(client, member, bill, provider_name="Rejected Name")
        rejected = await client.post(
            f"/api/v1/change-requests/{req['id']}/reject",
            headers=auth(user_b),
            json={"note": "Statement does not support this"},
        )
        assert rejected.status_code == 200
        assert rejected.json()["status"] == "rejected"

        after = await client.get(f"/api/v1/bills/{bill['id']}", headers=auth(member))
        assert after.json()["provider_name"] == bill["provider_name"]

    async def test_member_cannot_approve_their_own_request(
        self, client: AsyncClient, member: dict, bill: dict
    ):
        req = await _file_update(client, member, bill)
        resp = await client.post(
            f"/api/v1/change-requests/{req['id']}/approve", headers=auth(member)
        )
        assert resp.status_code == 403

    async def test_a_request_can_only_be_reviewed_once(
        self, client: AsyncClient, user_b: dict, member: dict, bill: dict
    ):
        req = await _file_update(client, member, bill)
        first = await client.post(
            f"/api/v1/change-requests/{req['id']}/approve", headers=auth(user_b)
        )
        assert first.status_code == 200
        second = await client.post(
            f"/api/v1/change-requests/{req['id']}/reject", headers=auth(user_b)
        )
        assert second.status_code == 409

    async def test_member_can_withdraw_their_own_request(
        self, client: AsyncClient, member: dict, bill: dict
    ):
        req = await _file_update(client, member, bill)
        resp = await client.post(
            f"/api/v1/change-requests/{req['id']}/cancel", headers=auth(member)
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"


class TestExpiry:
    """A request nobody reviews in CHANGE_REQUEST_TTL_MINUTES lapses, so a
    stale edit can never be approved long after the record has moved on."""

    async def test_a_new_request_carries_a_deadline(
        self, client: AsyncClient, member: dict, bill: dict
    ):
        req = await _file_update(client, member, bill)
        assert req["expires_at"] is not None

    async def test_reading_the_queue_lapses_an_overdue_request(
        self, client: AsyncClient, db_session, user_b: dict, member: dict, bill: dict
    ):
        req = await _file_update(client, member, bill)
        await _backdate(db_session, req["id"])

        queue = await client.get("/api/v1/change-requests/", headers=auth(user_b))
        row = next(r for r in queue.json()["items"] if r["id"] == req["id"])
        assert row["status"] == "expired"

    async def test_an_expired_request_cannot_be_approved(
        self, client: AsyncClient, db_session, user_b: dict, member: dict, bill: dict
    ):
        req = await _file_update(client, member, bill, provider_name="Too Late")
        await _backdate(db_session, req["id"])

        resp = await client.post(
            f"/api/v1/change-requests/{req['id']}/approve", headers=auth(user_b)
        )
        assert resp.status_code == 409

        after = await client.get(f"/api/v1/bills/{bill['id']}", headers=auth(member))
        assert after.json()["provider_name"] == bill["provider_name"]

    async def test_pending_filter_hides_expired_requests(
        self, client: AsyncClient, db_session, user_b: dict, member: dict, bill: dict
    ):
        req = await _file_update(client, member, bill)
        await _backdate(db_session, req["id"])

        pending = await client.get(
            "/api/v1/change-requests/?status=pending", headers=auth(user_b)
        )
        assert pending.json()["total"] == 0

    async def test_approving_in_time_still_works(
        self, client: AsyncClient, user_b: dict, member: dict, bill: dict
    ):
        """The deadline must not trip a request reviewed straight away."""
        req = await _file_update(client, member, bill, provider_name="In Time")
        resp = await client.post(
            f"/api/v1/change-requests/{req['id']}/approve", headers=auth(user_b)
        )
        assert resp.status_code == 200
        assert resp.json()["expires_at"] is None


class TestQueueVisibility:
    async def test_reviewers_see_the_whole_queue(
        self, client: AsyncClient, user_a: dict, user_b: dict, member: dict, bill: dict
    ):
        await _file_update(client, member, bill)
        for reviewer in (user_a, user_b):
            resp = await client.get(
                "/api/v1/change-requests/?status=pending", headers=auth(reviewer)
            )
            assert resp.status_code == 200
            assert resp.json()["total"] == 1

    async def test_member_sees_only_their_own(
        self, client: AsyncClient, user_a: dict, member: dict, bill: dict
    ):
        await _file_update(client, member, bill)

        # A second member files against the same vault.
        reg = await client.post(
            "/api/v1/auth/register",
            json={"email": "member2@test.com", "password": "Password123!", "full_name": "M2"},
        )
        other = {
            "id": None,
            "headers": {"Authorization": f"Bearer {reg.json()['access_token']}"},
        }
        me = await client.get("/api/v1/users/me", headers=other["headers"])
        other["id"] = me.json()["id"]
        await _file_update(client, other, bill, provider_name="Other Name")

        mine = await client.get("/api/v1/change-requests/", headers=auth(member))
        assert mine.json()["total"] == 1
        assert mine.json()["items"][0]["requested_by_id"] == member["id"]

        everything = await client.get("/api/v1/change-requests/", headers=auth(user_a))
        assert everything.json()["total"] == 2
