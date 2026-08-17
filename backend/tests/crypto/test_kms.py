"""Tests for the key-management providers.

The Vault tests use ``httpx.MockTransport``, so they assert the exact wire
protocol — path, body, headers, retry behaviour — with zero network access and
no running Vault.
"""

import base64
import json

import httpx
import pytest

from app.crypto.errors import (
    IntegrityError,
    KmsAuthError,
    KmsConfigurationError,
    KmsError,
    KmsUnavailableError,
)
from app.crypto.kms.providers.local import (
    LocalKmsProvider,
    parse_master_keys,
)
from app.crypto.kms.providers.pkcs11 import Pkcs11KmsProvider
from app.crypto.kms.providers.vault_transit import VaultTransitKmsProvider
from app.crypto.zeroize import DEK_LENGTH, EphemeralKey, random_dek, secure_zero

K1 = b"\x11" * 32
K2 = b"\x22" * 32
K3 = b"\x33" * 32
DEK = b"\xab" * 32


def b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


# --------------------------------------------------------------------------
# Master-key parsing — a typo here is unrecoverable data loss
# --------------------------------------------------------------------------


def test_parse_master_keys_accepts_padded_and_unpadded() -> None:
    padded = base64.urlsafe_b64encode(K1).decode()
    assert parse_master_keys([f"1:{padded}"]) == {1: K1}
    assert parse_master_keys([f"1:{padded.rstrip('=')}"]) == {1: K1}


def test_parse_master_keys_multiple_versions() -> None:
    assert parse_master_keys([f"1:{b64(K1)}", f"2:{b64(K2)}"]) == {1: K1, 2: K2}


def test_parse_master_keys_ignores_blank_entries() -> None:
    assert parse_master_keys([f"1:{b64(K1)}", "", "  "]) == {1: K1}


@pytest.mark.parametrize(
    ("entry", "match"),
    [
        (f"{b64(K1)}", "missing its 'version:' prefix"),
        (f"x:{b64(K1)}", "not an integer"),
        (f"0:{b64(K1)}", "must be >= 1"),
        ("1:!!!not-base64!!!", "not valid base64url"),
        (f"1:{b64(b'short')}", "decodes to 5 bytes"),
        (f"1:{b64(b'x' * 31)}", "decodes to 31 bytes"),
        (f"1:{b64(b'x' * 33)}", "decodes to 33 bytes"),
    ],
)
def test_parse_master_keys_rejects_bad_input(entry: str, match: str) -> None:
    with pytest.raises(KmsConfigurationError, match=match):
        parse_master_keys([entry])


def test_parse_master_keys_rejects_duplicate_version() -> None:
    with pytest.raises(KmsConfigurationError, match="defined twice"):
        parse_master_keys([f"1:{b64(K1)}", f"1:{b64(K2)}"])


# --------------------------------------------------------------------------
# LocalKmsProvider
# --------------------------------------------------------------------------


async def test_local_wrap_unwrap_roundtrip() -> None:
    kms = LocalKmsProvider({1: K1})
    wrapped = await kms.wrap_dek(DEK)
    assert wrapped.provider == "local"
    assert wrapped.wrap_alg == "AESKW"
    assert wrapped.key_version == 1
    assert bytes(await kms.unwrap_dek(wrapped)) == DEK


async def test_local_unwrap_returns_zeroable_bytearray() -> None:
    """The interface contract: callers must be able to erase what they get back."""
    kms = LocalKmsProvider({1: K1})
    out = await kms.unwrap_dek(await kms.wrap_dek(DEK))
    assert isinstance(out, bytearray)
    secure_zero(out)
    assert bytes(out) == b"\x00" * DEK_LENGTH


async def test_local_wrapped_dek_is_40_bytes() -> None:
    """Sizing check for the enc_wrapped_dek column."""
    kms = LocalKmsProvider({1: K1})
    assert len((await kms.wrap_dek(DEK)).ciphertext) == 40


async def test_local_wrap_does_not_leak_the_dek() -> None:
    kms = LocalKmsProvider({1: K1})
    assert DEK not in (await kms.wrap_dek(DEK)).ciphertext


async def test_local_highest_version_wraps() -> None:
    kms = LocalKmsProvider({1: K1, 3: K3, 2: K2})
    assert (await kms.wrap_dek(DEK)).key_version == 3
    assert await kms.current_key() == ("3", 3)


async def test_local_rotation_keeps_old_documents_readable() -> None:
    """The whole point of versioned master keys: adding a version must not
    orphan anything already wrapped."""
    old = LocalKmsProvider({1: K1})
    wrapped_under_v1 = await old.wrap_dek(DEK)

    rotated = LocalKmsProvider({1: K1, 2: K2})
    assert bytes(await rotated.unwrap_dek(wrapped_under_v1)) == DEK
    assert (await rotated.wrap_dek(DEK)).key_version == 2


async def test_local_missing_key_version_names_the_remedy() -> None:
    kms = LocalKmsProvider({2: K2})
    stale = await LocalKmsProvider({1: K1}).wrap_dek(DEK)
    with pytest.raises(KmsConfigurationError) as exc:
        await kms.unwrap_dek(stale)
    # A clean, actionable error — never a KeyError.
    assert "version 1 is not configured" in str(exc.value)
    assert "ENCRYPTION_MASTER_KEYS" in str(exc.value)
    assert "[2]" in str(exc.value)


async def test_local_wrong_master_key_is_an_integrity_error() -> None:
    wrapped = await LocalKmsProvider({1: K1}).wrap_dek(DEK)
    with pytest.raises(IntegrityError, match="AES-KW integrity check"):
        await LocalKmsProvider({1: K2}).unwrap_dek(wrapped)


async def test_local_corrupt_wrapped_dek_is_detected() -> None:
    kms = LocalKmsProvider({1: K1})
    wrapped = await kms.wrap_dek(DEK)
    corrupt = bytearray(wrapped.ciphertext)
    corrupt[5] ^= 0x01
    with pytest.raises(IntegrityError):
        await kms.unwrap_dek(
            type(wrapped)(
                provider=wrapped.provider,
                key_id=wrapped.key_id,
                key_version=wrapped.key_version,
                wrap_alg=wrapped.wrap_alg,
                ciphertext=bytes(corrupt),
            )
        )


async def test_local_refuses_foreign_wrap_alg() -> None:
    kms = LocalKmsProvider({1: K1})
    wrapped = await kms.wrap_dek(DEK)
    foreign = type(wrapped)(
        provider="vault_transit",
        key_id="k",
        key_version=1,
        wrap_alg="vault:transit",
        ciphertext=b"vault:v1:zzz",
    )
    with pytest.raises(KmsConfigurationError, match="only understands AESKW"):
        await kms.unwrap_dek(foreign)


@pytest.mark.parametrize("bad_len", [0, 16, 31, 33])
async def test_local_rejects_wrong_dek_length(bad_len: int) -> None:
    with pytest.raises(KmsConfigurationError, match="must be 32 bytes"):
        await LocalKmsProvider({1: K1}).wrap_dek(b"\x00" * bad_len)


def test_local_requires_at_least_one_key() -> None:
    with pytest.raises(KmsConfigurationError, match="requires at least one master key"):
        LocalKmsProvider({})


def test_local_rejects_wrong_length_master_key() -> None:
    with pytest.raises(KmsConfigurationError, match="is 16 bytes"):
        LocalKmsProvider({1: b"\x00" * 16})


async def test_local_health_check_passes() -> None:
    health = await LocalKmsProvider({1: K1, 2: K2}).health_check()
    assert health.ok is True
    assert health.provider == "local"
    assert health.key_version == 2


# --- the development fallback --------------------------------------------


class _FakeSettings:
    ENCRYPTION_MASTER_KEYS: list[str] = []
    SECRET_KEY = "dev-secret-key-that-is-long-enough-1234"
    is_production = False


def test_local_from_settings_uses_configured_keys() -> None:
    s = _FakeSettings()
    s.ENCRYPTION_MASTER_KEYS = [f"1:{b64(K1)}", f"2:{b64(K2)}"]
    assert LocalKmsProvider.from_settings(s).configured_versions == [1, 2]


def test_local_from_settings_derives_dev_key_and_warns(
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level("WARNING"):
        kms = LocalKmsProvider.from_settings(_FakeSettings())
    assert kms.configured_versions == [1]
    assert "local_kms_using_derived_dev_key" in caplog.text
    assert "PERMANENTLY UNDECRYPTABLE" in caplog.text


def test_local_from_settings_dev_key_is_deterministic() -> None:
    """Restarting the dev server must not orphan yesterday's uploads."""
    a = LocalKmsProvider.from_settings(_FakeSettings())
    b = LocalKmsProvider.from_settings(_FakeSettings())
    assert a._keys == b._keys  # noqa: SLF001


def test_local_from_settings_dev_key_differs_from_raw_secret_key() -> None:
    kms = LocalKmsProvider.from_settings(_FakeSettings())
    assert kms._keys[1] != _FakeSettings.SECRET_KEY.encode()[:32]  # noqa: SLF001


def test_local_from_settings_refuses_to_derive_in_production() -> None:
    """The guard that stops a dev-derived KEK ever reaching production."""

    class Prod(_FakeSettings):
        is_production = True

    with pytest.raises(KmsConfigurationError, match="required in production"):
        LocalKmsProvider.from_settings(Prod())


async def test_local_health_check_reports_derived_key() -> None:
    health = await LocalKmsProvider.from_settings(_FakeSettings()).health_check()
    assert health.ok is True
    assert "development key" in health.detail


# --------------------------------------------------------------------------
# PKCS#11 — refuses rather than silently wrapping in software
# --------------------------------------------------------------------------


def test_pkcs11_refuses_to_construct() -> None:
    with pytest.raises(KmsConfigurationError, match="interface only"):
        Pkcs11KmsProvider()


# --------------------------------------------------------------------------
# Vault Transit — exact wire protocol via MockTransport
# --------------------------------------------------------------------------


def vault(handler, **kwargs) -> VaultTransitKmsProvider:  # type: ignore[no-untyped-def]
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://vault.internal:8200"
    )
    params = {
        "addr": "https://vault.internal:8200",
        "token": "hvs.testtoken",
        "mount": "transit",
        "key_name": "taxvault-dek",
        "client": client,
    }
    params.update(kwargs)
    return VaultTransitKmsProvider(**params)  # type: ignore[arg-type]


async def test_vault_wrap_sends_exact_request() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["method"] = request.method
        seen["token"] = request.headers.get("X-Vault-Token")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"data": {"ciphertext": "vault:v3:AAAAdeadbeef"}})

    wrapped = await vault(handler).wrap_dek(DEK)

    assert seen["method"] == "POST"
    assert seen["path"] == "/v1/transit/encrypt/taxvault-dek"
    assert seen["token"] == "hvs.testtoken"
    # Vault requires standard base64, not base64url.
    assert seen["body"] == {"plaintext": base64.b64encode(DEK).decode()}

    assert wrapped.provider == "vault_transit"
    assert wrapped.wrap_alg == "vault:transit"
    assert wrapped.key_version == 3
    assert wrapped.key_id == "taxvault-dek"
    assert wrapped.ciphertext == b"vault:v3:AAAAdeadbeef"


async def test_vault_unwrap_roundtrip() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/transit/decrypt/taxvault-dek"
        assert json.loads(request.content) == {"ciphertext": "vault:v3:AAAAdeadbeef"}
        return httpx.Response(
            200, json={"data": {"plaintext": base64.b64encode(DEK).decode()}}
        )

    wrapped = (await vault(lambda r: httpx.Response(
        200, json={"data": {"ciphertext": "vault:v3:AAAAdeadbeef"}}
    )).wrap_dek(DEK))
    out = await vault(handler).unwrap_dek(wrapped)
    assert isinstance(out, bytearray)
    assert bytes(out) == DEK


async def test_vault_namespace_header_sent_when_configured() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["ns"] = request.headers.get("X-Vault-Namespace")
        return httpx.Response(200, json={"data": {"ciphertext": "vault:v1:x"}})

    await vault(handler, namespace="admin/taxvault").wrap_dek(DEK)
    assert seen["ns"] == "admin/taxvault"


async def test_vault_no_namespace_header_when_unset() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["has_ns"] = "X-Vault-Namespace" in request.headers
        return httpx.Response(200, json={"data": {"ciphertext": "vault:v1:x"}})

    await vault(handler).wrap_dek(DEK)
    assert seen["has_ns"] is False


@pytest.mark.parametrize(
    ("ciphertext", "expected"),
    [
        ("vault:v1:abc", 1),
        ("vault:v3:abc", 3),
        ("vault:v42:abc", 42),
        ("vault:abc", 1),  # legacy bare prefix
    ],
)
async def test_vault_parses_key_version(ciphertext: str, expected: int) -> None:
    wrapped = await vault(
        lambda r: httpx.Response(200, json={"data": {"ciphertext": ciphertext}})
    ).wrap_dek(DEK)
    assert wrapped.key_version == expected


async def test_vault_403_raises_auth_error_without_retrying() -> None:
    """An auth failure must not be retried: it will fail identically and only
    pollutes Vault's audit log."""
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(403, json={"errors": ["permission denied"]})

    with pytest.raises(KmsAuthError, match="rejected our credentials"):
        await vault(handler).wrap_dek(DEK)
    assert len(calls) == 1


async def test_vault_401_raises_auth_error() -> None:
    with pytest.raises(KmsAuthError):
        await vault(lambda r: httpx.Response(401, json={"errors": ["missing token"]})).wrap_dek(
            DEK
        )


async def test_vault_503_retries_once_then_reports_unavailable() -> None:
    """Sealed Vault is a routine event, so it is retried — but it is reported as
    'key service down', never as a corrupt document."""
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(503, json={"errors": ["Vault is sealed"]})

    with pytest.raises(KmsUnavailableError, match="sealed or in standby"):
        await vault(handler).wrap_dek(DEK)
    assert len(calls) == 2


async def test_vault_503_then_success_recovers() -> None:
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        if len(calls) == 1:
            return httpx.Response(503, json={"errors": ["sealed"]})
        return httpx.Response(200, json={"data": {"ciphertext": "vault:v1:ok"}})

    assert (await vault(handler).wrap_dek(DEK)).key_version == 1
    assert len(calls) == 2


async def test_vault_connect_error_is_unavailable_not_integrity() -> None:
    """The distinction operators depend on during an incident."""

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    with pytest.raises(KmsUnavailableError) as exc:
        await vault(handler).wrap_dek(DEK)
    assert "The document is intact" in str(exc.value)


async def test_vault_timeout_is_unavailable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out")

    with pytest.raises(KmsUnavailableError):
        await vault(handler).wrap_dek(DEK)


async def test_vault_400_is_a_plain_kms_error() -> None:
    with pytest.raises(KmsError, match="400"):
        await vault(
            lambda r: httpx.Response(400, json={"errors": ["invalid ciphertext"]})
        ).unwrap_dek(
            __import__("app.crypto.kms.base", fromlist=["WrappedKey"]).WrappedKey(
                provider="vault_transit",
                key_id="taxvault-dek",
                key_version=1,
                wrap_alg="vault:transit",
                ciphertext=b"vault:v1:bad",
            )
        )


async def test_vault_missing_data_field_is_reported() -> None:
    with pytest.raises(KmsError, match="missing the expected data.ciphertext"):
        await vault(lambda r: httpx.Response(200, json={"data": {}})).wrap_dek(DEK)


async def test_vault_current_key_reads_latest_version() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/transit/keys/taxvault-dek"
        return httpx.Response(200, json={"data": {"latest_version": 7}})

    assert await vault(handler).current_key() == ("taxvault-dek", 7)


async def test_vault_health_check_never_raises() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    health = await vault(handler).health_check()
    assert health.ok is False
    assert health.provider == "vault_transit"
    assert "KmsUnavailableError" in health.detail


async def test_vault_rotate_returns_new_version() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/rotate"):
            return httpx.Response(200, json={})
        return httpx.Response(200, json={"data": {"latest_version": 8}})

    assert await vault(handler).rotate() == ("taxvault-dek", 8)


def test_vault_requires_addr_and_token() -> None:
    with pytest.raises(KmsConfigurationError, match="VAULT_ADDR is required"):
        VaultTransitKmsProvider(addr="", token="t")
    with pytest.raises(KmsConfigurationError, match="VAULT_TOKEN is required"):
        VaultTransitKmsProvider(addr="https://v:8200", token="")


# --------------------------------------------------------------------------
# Cross-provider: the wrapped key is opaque and non-portable
# --------------------------------------------------------------------------


async def test_providers_refuse_each_others_wrapped_keys() -> None:
    local_wrapped = await LocalKmsProvider({1: K1}).wrap_dek(DEK)
    with pytest.raises(KmsConfigurationError, match="Cannot unwrap 'AESKW'"):
        await vault(lambda r: httpx.Response(200, json={})).unwrap_dek(local_wrapped)


# --------------------------------------------------------------------------
# Zeroization helpers
# --------------------------------------------------------------------------


def test_secure_zero_clears_a_bytearray() -> None:
    buf = bytearray(b"super secret key material")
    secure_zero(buf)
    assert bytes(buf) == b"\x00" * 25


def test_secure_zero_tolerates_none_and_empty() -> None:
    secure_zero(None)
    secure_zero(bytearray())


def test_random_dek_is_32_bytes_and_mutable() -> None:
    dek = random_dek()
    assert isinstance(dek, bytearray)
    assert len(dek) == DEK_LENGTH
    assert dek != random_dek()


def test_ephemeral_key_zeroes_on_exit() -> None:
    dek = random_dek()
    with EphemeralKey(dek) as key:
        assert any(key)
    assert bytes(dek) == b"\x00" * DEK_LENGTH


def test_ephemeral_key_zeroes_even_when_the_body_raises() -> None:
    """The reason this is a context manager and not a try/del."""
    dek = random_dek()
    with pytest.raises(RuntimeError), EphemeralKey(dek):
        raise RuntimeError("encryption blew up")
    assert bytes(dek) == b"\x00" * DEK_LENGTH


def test_ephemeral_key_rejects_immutable_bytes() -> None:
    with pytest.raises(TypeError, match="cannot be zeroed"):
        EphemeralKey(b"immutable")  # type: ignore[arg-type]
