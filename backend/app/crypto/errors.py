"""Exception hierarchy for the envelope-encryption subsystem.

These are deliberately NOT ``HTTPException`` subclasses. The crypto layer knows
nothing about HTTP; the route layer decides what a given failure looks like to a
client. That separation matters most for one distinction:

    IntegrityError      -> the object is corrupt or forged   -> 500 / alert
    KmsUnavailableError -> Vault is sealed or unreachable    -> 503 / retry

A download that fails because the key service is down must never be reported as
a corrupt document. Operators chase those two symptoms in completely different
directions, and conflating them costs hours during an incident.
"""


class CryptoError(Exception):
    """Base for every failure raised by ``app.crypto``."""


class UnsupportedFormatError(CryptoError):
    """The object is not a TaxVault envelope, or is a version we cannot read.

    Raised before any key material is touched - bad magic bytes, an unknown
    format version or algorithm id, a truncated header, or reserved bits set.
    """


class IntegrityError(CryptoError):
    """Authentication failed: the object has been tampered with or is corrupt.

    Covers a failed GCM tag, a failed Ed25519 signature, a plaintext SHA-256
    mismatch, and length fields that disagree with the actual object size.

    This is a security event. It never carries detail about *which* check failed
    in its client-facing form - see the route layer - but the log line should.
    """


class KmsError(CryptoError):
    """Generic key-management provider failure."""


class KmsAuthError(KmsError):
    """The provider rejected our credentials (expired/revoked token, denied policy).

    Never retried: a 403 from Vault will be a 403 on the second attempt too, and
    retrying an auth failure only makes the audit trail noisier.
    """


class KmsUnavailableError(KmsError):
    """The provider is unreachable, sealed, or timed out.

    Retryable, and - crucially - *not* a data-integrity problem. The ciphertext
    is fine; we simply cannot unwrap the key right now.
    """


class KmsConfigurationError(KmsError):
    """The provider is misconfigured - bad master key, unknown key version, missing setting.

    Raised at construction time wherever possible, so a misconfigured deployment
    fails at startup rather than on the first user download.
    """
