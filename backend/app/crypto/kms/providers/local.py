"""AES-KW key wrapping under master keys held in configuration.

The default provider, and the one a self-hosted deployment runs unless it stands
up Vault. Master keys come from ``ENCRYPTION_MASTER_KEYS`` as a comma-separated
list of ``version:base64url_32_bytes``. The highest version wraps; every
configured version unwraps, which is what makes KEK rotation a real, testable
operation rather than a flag day:

    1. add a higher version to ENCRYPTION_MASTER_KEYS and restart
    2. new documents wrap under it immediately; old ones keep opening
    3. re-wrap existing rows at leisure (a database-only UPDATE - the objects
       themselves are never touched, because the DEK does not change)
    4. once no row references the old version, drop it from configuration

WHY AES-KW AND NOT AES-GCM
--------------------------
AES-KW (RFC 3394) is deterministic and nonce-free. That matters here and nowhere
else in this system: the KEK is long-lived and wraps *every* DEK in the
deployment, which is precisely the position where you do not want a 96-bit
random nonce and its birthday bound. Per-document DEKs get GCM because each one
encrypts exactly one message; the KEK gets AES-KW because it encrypts millions.

WHY A SEPARATE SECRET AND NOT ONE DERIVED FROM SECRET_KEY
---------------------------------------------------------
Three reasons, in order of severity:

1. ``SECRET_KEY`` is the JWT signing key. It gets rotated the moment a token
   leaks - a different cadence, a different reflex, often a different person.
   Deriving the KEK from it means a routine JWT rotation **silently makes every
   document permanently undecryptable.** That is a data-loss bug with a
   plausible trigger and no warning.
2. ``SECRET_KEY`` is only length-checked, and only in production. The string
   "change-me-please-1234567890123456" passes. Deriving a data-encryption key
   from a possibly-low-entropy operator-chosen value is indefensible.
3. Separate secret, separate blast radius, separate rotation runbook.

The development fallback below is the single exception, and it exists only so
``pytest`` and ``uvicorn`` start with zero setup. Production is hard-failed by
the settings validator, so it can never ship.
"""

import base64
import binascii
import logging
from typing import ClassVar

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.keywrap import (
    InvalidUnwrap,
    aes_key_unwrap,
    aes_key_wrap,
)

from app.crypto.errors import IntegrityError, KmsConfigurationError
from app.crypto.kms.base import KeyManagementProvider, KmsHealth, WrappedKey
from app.crypto.zeroize import DEK_LENGTH

logger = logging.getLogger("taxvault.crypto")

__all__ = ["LocalKmsProvider", "parse_master_keys"]

WRAP_ALG = "AESKW"
MASTER_KEY_LENGTH = 32

#: Domain separation for the development-only derived KEK.
_DEV_KEK_SALT = b"taxvault-dev-kek"
_DEV_KEK_INFO = b"local-kms-v1"


def parse_master_keys(entries: list[str]) -> dict[int, bytes]:
    """Parse ``["1:<b64url>", "2:<b64url>"]`` into ``{version: key_bytes}``.

    Strict on purpose: a typo in a master key is unrecoverable data loss, so
    every failure mode gets its own message rather than a generic parse error.
    """
    keys: dict[int, bytes] = {}
    for raw in entries:
        entry = raw.strip()
        if not entry:
            continue
        if ":" not in entry:
            raise KmsConfigurationError(
                f"Master key entry {entry[:12]!r}... is missing its 'version:' prefix. "
                "Expected 'version:base64url_key', e.g. '1:AAAA...'."
            )
        version_str, _, b64 = entry.partition(":")
        try:
            version = int(version_str)
        except ValueError as exc:
            raise KmsConfigurationError(
                f"Master key version {version_str!r} is not an integer."
            ) from exc
        if version < 1:
            raise KmsConfigurationError(f"Master key version must be >= 1, got {version}.")
        if version in keys:
            raise KmsConfigurationError(f"Master key version {version} is defined twice.")
        try:
            key = base64.urlsafe_b64decode(_pad_b64(b64.strip()))
        except (binascii.Error, ValueError) as exc:
            raise KmsConfigurationError(
                f"Master key version {version} is not valid base64url."
            ) from exc
        if len(key) != MASTER_KEY_LENGTH:
            raise KmsConfigurationError(
                f"Master key version {version} decodes to {len(key)} bytes; "
                f"exactly {MASTER_KEY_LENGTH} are required for AES-256."
            )
        keys[version] = key
    return keys


def _pad_b64(s: str) -> str:
    """Accept base64url with or without '=' padding - operators paste both."""
    return s + "=" * (-len(s) % 4)


class LocalKmsProvider(KeyManagementProvider):
    name: ClassVar[str] = "local"

    def __init__(self, master_keys: dict[int, bytes], *, derived: bool = False) -> None:
        if not master_keys:
            raise KmsConfigurationError(
                "LocalKmsProvider requires at least one master key. Set "
                "ENCRYPTION_MASTER_KEYS, e.g.\n"
                '  python -c "import secrets,base64; '
                "print('1:'+base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())\""
            )
        for version, key in master_keys.items():
            if len(key) != MASTER_KEY_LENGTH:
                raise KmsConfigurationError(
                    f"Master key version {version} is {len(key)} bytes; "
                    f"{MASTER_KEY_LENGTH} required."
                )
        self._keys = dict(master_keys)
        self._current_version = max(self._keys)
        self._derived = derived

    # -- construction ------------------------------------------------------

    @classmethod
    def from_settings(cls, settings: object) -> "LocalKmsProvider":
        """Build from application settings, with a development-only fallback."""
        entries: list[str] = list(getattr(settings, "ENCRYPTION_MASTER_KEYS", []) or [])
        if entries:
            return cls(parse_master_keys(entries))

        is_production = bool(getattr(settings, "is_production", False))
        if is_production:
            # Belt and braces: the settings validator should already have
            # refused to construct. Never reachable in a correct build.
            raise KmsConfigurationError(
                "ENCRYPTION_MASTER_KEYS is required in production. Refusing to "
                "derive a master key from SECRET_KEY."
            )

        secret = str(getattr(settings, "SECRET_KEY", "") or "")
        if not secret:
            raise KmsConfigurationError(
                "Neither ENCRYPTION_MASTER_KEYS nor SECRET_KEY is set; cannot start."
            )
        logger.warning(
            "local_kms_using_derived_dev_key: ENCRYPTION_MASTER_KEYS is unset, so the "
            "master key is being derived from SECRET_KEY for development. Rotating "
            "SECRET_KEY will make every stored document PERMANENTLY UNDECRYPTABLE. "
            "Set ENCRYPTION_MASTER_KEYS before storing anything you care about."
        )
        return cls({1: cls._derive_dev_key(secret)}, derived=True)

    @staticmethod
    def _derive_dev_key(secret_key: str) -> bytes:
        return HKDF(
            algorithm=hashes.SHA256(),
            length=MASTER_KEY_LENGTH,
            salt=_DEV_KEK_SALT,
            info=_DEV_KEK_INFO,
        ).derive(secret_key.encode("utf-8"))

    # -- interface ---------------------------------------------------------

    async def wrap_dek(self, dek: bytes | bytearray) -> WrappedKey:
        if len(dek) != DEK_LENGTH:
            raise KmsConfigurationError(
                f"DEK must be {DEK_LENGTH} bytes for AES-256, got {len(dek)}."
            )
        version = self._current_version
        ciphertext = aes_key_wrap(self._keys[version], bytes(dek))
        return WrappedKey(
            provider=self.name,
            key_id=str(version),
            key_version=version,
            wrap_alg=WRAP_ALG,
            ciphertext=ciphertext,
        )

    async def unwrap_dek(self, wrapped: WrappedKey) -> bytearray:
        if wrapped.wrap_alg != WRAP_ALG:
            raise KmsConfigurationError(
                f"Cannot unwrap {wrapped.wrap_alg!r} with the local provider; "
                f"this provider only understands {WRAP_ALG}."
            )
        key = self._keys.get(wrapped.key_version)
        if key is None:
            # The most dangerous operational error there is, so it gets the
            # clearest message: the ciphertext is fine, the master key is gone.
            raise KmsConfigurationError(
                f"Master key version {wrapped.key_version} is not configured. "
                f"Configured versions: {sorted(self._keys)}. The document is intact "
                "but cannot be opened until that key is restored to "
                "ENCRYPTION_MASTER_KEYS."
            )
        try:
            return bytearray(aes_key_unwrap(key, wrapped.ciphertext))
        except InvalidUnwrap as exc:
            raise IntegrityError(
                f"Wrapped DEK failed AES-KW integrity check under master key version "
                f"{wrapped.key_version}: the stored key material is corrupt or was "
                "wrapped under a different key."
            ) from exc

    async def current_key(self) -> tuple[str, int]:
        return str(self._current_version), self._current_version

    async def health_check(self) -> KmsHealth:
        try:
            probe = bytearray(b"\x00" * DEK_LENGTH)
            unwrapped = await self.unwrap_dek(await self.wrap_dek(probe))
            ok = unwrapped == probe
        except Exception as exc:  # noqa: BLE001 - health checks must never raise
            return KmsHealth(
                ok=False,
                provider=self.name,
                key_id=str(self._current_version),
                detail=f"{type(exc).__name__}: {exc}",
            )
        detail = "using a SECRET_KEY-derived development key" if self._derived else ""
        return KmsHealth(
            ok=ok,
            provider=self.name,
            key_id=str(self._current_version),
            key_version=self._current_version,
            detail=detail,
        )

    @property
    def configured_versions(self) -> list[int]:
        """Exposed for the startup log and re-wrap tooling."""
        return sorted(self._keys)
