"""PKCS#11 HSM provider - interface only, not implemented in this release.

This file exists so the shape of an HSM backend is fixed and reviewable before
anyone builds it, and so ``KMS_PROVIDER=pkcs11`` fails at startup with an honest
message rather than a confusing import error.

A real implementation needs, at minimum:

  * a ``python-pkcs11`` or ``PyKCS11`` binding plus the vendor's .so/.dll
  * a session pool - PKCS#11 sessions are not thread-safe and login is
    expensive, so a per-worker pool with health checks is mandatory
  * ``C_WrapKey`` / ``C_UnwrapKey`` with ``CKM_AES_KEY_WRAP`` against a
    non-extractable ``CKO_SECRET_KEY``, so the KEK never leaves the device
  * a slot/token/PIN configuration surface, with the PIN sourced from the
    secrets manager rather than the environment
  * ``CKR_DEVICE_ERROR`` / ``CKR_TOKEN_NOT_PRESENT`` mapped to
    ``KmsUnavailableError``, and ``CKR_PIN_*`` mapped to ``KmsAuthError``

Deliberately not stubbed with fake behaviour: a provider that silently wraps in
software while claiming to be an HSM is worse than one that refuses to start.
"""

from typing import ClassVar

from app.crypto.errors import KmsConfigurationError
from app.crypto.kms.base import KeyManagementProvider, KmsHealth, WrappedKey

__all__ = ["Pkcs11KmsProvider"]


class Pkcs11KmsProvider(KeyManagementProvider):
    name: ClassVar[str] = "pkcs11"

    def __init__(self) -> None:
        raise KmsConfigurationError(
            "KMS_PROVIDER='pkcs11' is an interface only in this release and has no "
            "implementation. Use 'local' or 'vault_transit'."
        )

    async def wrap_dek(self, dek: bytes | bytearray) -> WrappedKey:  # pragma: no cover
        raise NotImplementedError

    async def unwrap_dek(self, wrapped: WrappedKey) -> bytearray:  # pragma: no cover
        raise NotImplementedError

    async def current_key(self) -> tuple[str, int]:  # pragma: no cover
        raise NotImplementedError

    async def health_check(self) -> KmsHealth:  # pragma: no cover
        raise NotImplementedError
