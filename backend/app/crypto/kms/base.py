"""The key-management provider interface.

Every backend - the local AES-KW provider, HashiCorp Vault Transit, a PKCS#11
HSM, or a cloud KMS - implements this and nothing else. Application code
resolves a provider through ``app.crypto.kms.factory.get_kms()`` and never
imports a concrete class, so swapping backends is a configuration change rather
than a code change. That is the portability requirement, honoured by keeping the
interface small enough that every backend can implement it honestly.

WHY THE INTERFACE IS ASYNC
--------------------------
Vault Transit makes an HTTP round-trip on every wrap and unwrap, and unwrap sits
on the download hot path - it must not occupy the event loop. The local provider
is pure CPU (AES-KW of 32 bytes is microseconds) and simply declares ``async
def`` with no awaits, which costs nothing. Making the interface synchronous
would force a thread-pool bridge around Vault, which is strictly worse.

WHY THERE IS NO ``aad`` PARAMETER
---------------------------------
AES-KW (RFC 3394) has no AAD slot at all, and Vault Transit's ``context`` field
is for derived/convergent encryption keys, not additional authenticated data. An
``aad=`` argument that two of three providers silently ignore would be a lie in
the type signature - the kind that reads as a security control and provides
none. The binding callers actually want lives one layer up, in the envelope's
AAD (see ``app.crypto.envelope``), where every backend honours it uniformly
because it never reaches the backend at all.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import ClassVar

__all__ = ["KeyManagementProvider", "KmsHealth", "WrappedKey"]


@dataclass(frozen=True, slots=True)
class WrappedKey:
    """A DEK as wrapped by some provider, plus everything needed to unwrap it later.

    Every field is persisted alongside the document. ``provider`` and
    ``wrap_alg`` together are what let a deployment migrate backends without a
    flag day: old rows keep naming the old provider and stay readable as long as
    that provider is still configured.
    """

    provider: str
    """Provider name, e.g. "local" | "vault_transit" | "pkcs11"."""

    key_id: str
    """Provider-side key identifier - a master-key version, a Vault key name."""

    key_version: int
    """The version of that key in force at wrap time. Drives re-wrap on rotation."""

    wrap_alg: str
    """Wrapping algorithm, e.g. "AESKW" | "vault:transit"."""

    ciphertext: bytes
    """Provider-opaque wrapped key material. Never interpreted outside its provider."""


@dataclass(frozen=True, slots=True)
class KmsHealth:
    """Result of a liveness probe, surfaced at startup and on /health."""

    ok: bool
    provider: str
    key_id: str
    key_version: int | None = None
    detail: str = ""


class KeyManagementProvider(ABC):
    """Wraps and unwraps data-encryption keys. Never sees plaintext documents."""

    name: ClassVar[str]

    @abstractmethod
    async def wrap_dek(self, dek: bytes | bytearray) -> WrappedKey:
        """Encrypt a DEK under the provider's current master key."""

    @abstractmethod
    async def unwrap_dek(self, wrapped: WrappedKey) -> bytearray:
        """Recover a DEK.

        Returns a **mutable** ``bytearray`` so the caller can erase it; callers
        own that zeroization and should use ``app.crypto.zeroize.EphemeralKey``.

        An honest caveat, repeated from ``zeroize`` because this is where it
        bites: the DEK arrives either from OpenSSL's AES-KW output or from
        ``base64.b64decode`` of a Vault JSON response, and **both allocate an
        intermediate immutable ``bytes`` that cannot be zeroed**. Zeroization
        shortens the window during which the key is resident; it does not remove
        the fact that it was. Anyone claiming stronger is wrong.

        Raises ``KmsAuthError`` if credentials were rejected,
        ``KmsUnavailableError`` if the provider is unreachable or sealed, and
        ``KmsConfigurationError`` if the referenced key version is unknown. The
        route layer depends on that distinction: a sealed Vault must surface as
        503, never as a corrupt document.
        """

    @abstractmethod
    async def current_key(self) -> tuple[str, int]:
        """The ``(key_id, version)`` new wraps will use."""

    @abstractmethod
    async def health_check(self) -> KmsHealth:
        """Probe reachability and key availability. Must not raise."""

    async def rotate(self) -> tuple[str, int]:
        """Create a new key version and return it.

        Not every backend supports rotation through this API - a local provider
        rotates by editing configuration, an HSM by an operator ceremony - so
        the default refuses rather than pretending.
        """
        raise NotImplementedError(f"{self.name} does not support rotation through this API.")
