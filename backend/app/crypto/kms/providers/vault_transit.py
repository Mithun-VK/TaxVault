"""HashiCorp Vault Transit provider.

Transit is Vault's encryption-as-a-service engine: the key never leaves Vault,
we send a DEK and get back an opaque ``vault:v3:...`` string. That moves the KEK
out of the application's blast radius entirely - a stolen application server no
longer yields the master key, only the ability to ask Vault to unwrap while the
token is valid.

Built on ``httpx`` rather than ``hvac`` because httpx is already a dependency and
is natively async; ``hvac`` is synchronous and would need a thread-pool bridge on
the download hot path.

ERROR MAPPING IS LOAD-BEARING
-----------------------------
Operators chase "corrupt document" and "key service down" in completely
different directions, so the two must never be conflated:

    403                     -> KmsAuthError        (token expired or revoked)
    503 / 5xx / timeout     -> KmsUnavailableError (sealed, unreachable, failing over)
    anything else           -> KmsError

A document that will not open because Vault is sealed is not a damaged document,
and must not be reported as one.

RETRIES
-------
One retry with jitter on connect errors and 5xx, because Vault seal/unseal and
HA failover are routine events rather than exceptional ones. **403 is never
retried** - an auth failure will fail identically on the second attempt and only
adds noise to Vault's audit log.
"""

import asyncio
import base64
import logging
import random
from typing import Any, ClassVar

import httpx

from app.crypto.errors import (
    KmsAuthError,
    KmsConfigurationError,
    KmsError,
    KmsUnavailableError,
)
from app.crypto.kms.base import KeyManagementProvider, KmsHealth, WrappedKey
from app.crypto.zeroize import DEK_LENGTH

logger = logging.getLogger("taxvault.crypto")

__all__ = ["VaultTransitKmsProvider"]

WRAP_ALG = "vault:transit"
_MAX_ATTEMPTS = 2


class VaultTransitKmsProvider(KeyManagementProvider):
    name: ClassVar[str] = "vault_transit"

    def __init__(
        self,
        *,
        addr: str,
        token: str,
        mount: str = "transit",
        key_name: str = "taxvault-dek",
        namespace: str = "",
        timeout: float = 5.0,
        verify_tls: bool = True,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        if not addr:
            raise KmsConfigurationError("VAULT_ADDR is required for the vault_transit provider.")
        if not token:
            raise KmsConfigurationError("VAULT_TOKEN is required for the vault_transit provider.")
        self._addr = addr.rstrip("/")
        self._token = token
        self._mount = mount.strip("/")
        self._key_name = key_name
        self._namespace = namespace
        self._timeout = timeout
        self._verify_tls = verify_tls
        self._client = client
        self._owns_client = client is None

    @classmethod
    def from_settings(cls, settings: Any) -> "VaultTransitKmsProvider":
        return cls(
            addr=settings.VAULT_ADDR,
            token=settings.VAULT_TOKEN,
            mount=settings.VAULT_TRANSIT_MOUNT,
            key_name=settings.VAULT_TRANSIT_KEY,
            namespace=settings.VAULT_NAMESPACE,
            timeout=settings.VAULT_TIMEOUT_SECONDS,
            verify_tls=settings.VAULT_VERIFY_TLS,
        )

    # -- transport ---------------------------------------------------------

    @property
    def _headers(self) -> dict[str, str]:
        headers = {"X-Vault-Token": self._token}
        if self._namespace:
            headers["X-Vault-Namespace"] = self._namespace
        return headers

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self._addr,
                verify=self._verify_tls,
                timeout=httpx.Timeout(self._timeout, connect=2.0),
            )
        return self._client

    async def aclose(self) -> None:
        if self._client is not None and self._owns_client:
            await self._client.aclose()
            self._client = None

    async def _request(
        self, method: str, path: str, payload: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        client = self._get_client()
        last_exc: Exception | None = None

        for attempt in range(1, _MAX_ATTEMPTS + 1):
            try:
                response = await client.request(
                    method, path, json=payload, headers=self._headers
                )
            except (httpx.ConnectError, httpx.TimeoutException) as exc:
                last_exc = exc
                if attempt < _MAX_ATTEMPTS:
                    await self._backoff(attempt)
                    continue
                raise KmsUnavailableError(
                    f"Vault unreachable at {self._addr} after {attempt} attempts: "
                    f"{type(exc).__name__}. The document is intact; the key service is not."
                ) from exc
            except httpx.HTTPError as exc:  # pragma: no cover - transport-level oddities
                raise KmsError(f"Vault transport error: {exc}") from exc

            if response.status_code in (401, 403):
                # Never retried: a rejected token will be rejected again, and
                # repeating it only pollutes Vault's audit log.
                raise KmsAuthError(
                    f"Vault rejected our credentials ({response.status_code}) on {path}. "
                    "The token is likely expired, revoked, or lacks a policy for this key."
                )
            if response.status_code == 503:
                last_exc = KmsUnavailableError("sealed")
                if attempt < _MAX_ATTEMPTS:
                    await self._backoff(attempt)
                    continue
                raise KmsUnavailableError(
                    f"Vault returned 503 on {path}: it is sealed or in standby. "
                    "The document is intact; the key service is not."
                )
            if response.status_code >= 500:
                last_exc = KmsError(f"status {response.status_code}")
                if attempt < _MAX_ATTEMPTS:
                    await self._backoff(attempt)
                    continue
                raise KmsUnavailableError(
                    f"Vault returned {response.status_code} on {path} after {attempt} attempts."
                )
            if response.status_code >= 400:
                raise KmsError(
                    f"Vault returned {response.status_code} on {path}: "
                    f"{_safe_errors(response)}"
                )

            try:
                return dict(response.json())
            except ValueError as exc:
                raise KmsError(f"Vault returned a non-JSON body on {path}.") from exc

        raise KmsUnavailableError(f"Vault request to {path} exhausted retries: {last_exc}")

    @staticmethod
    async def _backoff(attempt: int) -> None:
        # Jittered, and short: this sits on a user-facing download.
        await asyncio.sleep(min(0.25 * attempt, 0.5) * (0.5 + random.random()))  # noqa: S311

    # -- interface ---------------------------------------------------------

    async def wrap_dek(self, dek: bytes | bytearray) -> WrappedKey:
        if len(dek) != DEK_LENGTH:
            raise KmsConfigurationError(
                f"DEK must be {DEK_LENGTH} bytes for AES-256, got {len(dek)}."
            )
        body = await self._request(
            "POST",
            f"/v1/{self._mount}/encrypt/{self._key_name}",
            {"plaintext": base64.b64encode(bytes(dek)).decode("ascii")},
        )
        ciphertext = _require(body, "ciphertext")
        return WrappedKey(
            provider=self.name,
            key_id=self._key_name,
            key_version=_parse_version(ciphertext),
            wrap_alg=WRAP_ALG,
            # Vault ciphertext is an ASCII "vault:v3:..." string; store its UTF-8
            # bytes so the column type matches the local provider's raw bytes.
            ciphertext=ciphertext.encode("ascii"),
        )

    async def unwrap_dek(self, wrapped: WrappedKey) -> bytearray:
        if wrapped.wrap_alg != WRAP_ALG:
            raise KmsConfigurationError(
                f"Cannot unwrap {wrapped.wrap_alg!r} with the vault_transit provider."
            )
        body = await self._request(
            "POST",
            f"/v1/{self._mount}/decrypt/{wrapped.key_id}",
            {"ciphertext": wrapped.ciphertext.decode("ascii")},
        )
        try:
            # b64decode allocates an immutable bytes we cannot zero - the leak
            # documented in KeyManagementProvider.unwrap_dek.
            return bytearray(base64.b64decode(_require(body, "plaintext")))
        except (ValueError, TypeError) as exc:
            raise KmsError("Vault returned a plaintext field that is not valid base64.") from exc

    async def current_key(self) -> tuple[str, int]:
        body = await self._request("GET", f"/v1/{self._mount}/keys/{self._key_name}")
        data = body.get("data") or {}
        version = data.get("latest_version")
        if not isinstance(version, int):
            raise KmsError(f"Vault key {self._key_name!r} reported no latest_version.")
        return self._key_name, version

    async def rotate(self) -> tuple[str, int]:
        await self._request("POST", f"/v1/{self._mount}/keys/{self._key_name}/rotate")
        return await self.current_key()

    async def health_check(self) -> KmsHealth:
        try:
            key_id, version = await self.current_key()
        except Exception as exc:  # noqa: BLE001 - health checks must never raise
            return KmsHealth(
                ok=False,
                provider=self.name,
                key_id=self._key_name,
                detail=f"{type(exc).__name__}: {exc}",
            )
        return KmsHealth(ok=True, provider=self.name, key_id=key_id, key_version=version)


def _require(body: dict[str, Any], field: str) -> str:
    data = body.get("data") or {}
    value = data.get(field)
    if not isinstance(value, str) or not value:
        raise KmsError(f"Vault response is missing the expected data.{field} field.")
    return value


def _parse_version(ciphertext: str) -> int:
    """Extract N from a ``vault:vN:...`` ciphertext.

    Version 1 keys historically emitted a bare ``vault:`` prefix, so an
    unparseable version means v1 rather than an error.
    """
    parts = ciphertext.split(":", 2)
    if len(parts) >= 2 and parts[1].startswith("v"):
        try:
            return int(parts[1][1:])
        except ValueError:
            pass
    return 1


def _safe_errors(response: httpx.Response) -> str:
    """Vault's error list, never the raw body - it can echo request material."""
    try:
        errors = response.json().get("errors")
    except ValueError:
        return "<unparseable body>"
    if isinstance(errors, list):
        return "; ".join(str(e) for e in errors[:3])
    return "<no errors field>"
