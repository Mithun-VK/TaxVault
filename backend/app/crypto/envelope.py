"""The TaxVault encrypted-object format: seal() and open_().

FORMAT (alg_id 0x01), all integers big-endian::

    offset  len   field              notes
      0      6    magic              b"TVENC\\x00"
      6      1    format_version     0x01
      7      1    alg_id             0x01 = AES-256-GCM single-shot
      8      2    header_len         uint16, = 96 for v1
     10      4    flags              bit0 signature present
                                     bit1 plaintext_sha256 present
                                     bits 2..31 MUST be zero
     14     12    nonce              96-bit random GCM IV
     26      8    plaintext_len      uint64
     34     32    plaintext_sha256   SHA-256 over the plaintext
     66     16    key_ref            SHA-256(wrapped_dek_ciphertext)[:16]
     82      8    created_at_unix    uint64 seconds
     90      2    aad_ctx_len        uint16, = 0 in v1 (context is reconstructed,
                                     never stored)
     92      4    reserved           MUST be zero
    ------  96    -- end of header --
     96      N    ciphertext         AES-256-GCM(dek, nonce, plaintext, aad)
    96+N    16    gcm_tag
    112+N   64    ed25519_signature  present iff flags bit0

Object size is exactly ``96 + plaintext_len + 16 [+ 64]``, which gives a cheap
pre-decrypt truncation check.

WHY SINGLE-SHOT AND NOT CHUNKED
-------------------------------
Chunk framing solves two problems: bounding memory for objects too large to
hold, and emitting plaintext before the whole object is authenticated. Neither
applies at a 20 MB cap — and the second is a security *downgrade*. With
single-shot GCM the tag is verified before one plaintext byte reaches the
client; with chunking you are by construction releasing data that has not been
authenticated in aggregate. There is also a structural reason: plaintext_sha256
lives in the header and cannot be written until the whole plaintext is hashed.

alg_id 0x02 is reserved for a chunked mode, specified at the bottom of this
module but deliberately not implemented, so the decision stays reversible
without a format break.

WHY THE STORAGE KEY IS IN THE AAD
---------------------------------
Binding the object to its storage key defeats a cut-and-paste attack that the
DB-side wrapped DEK does *not* stop: an attacker with bucket write access
swapping object bytes between two keys while the database is untouched. That is
precisely the stolen-object-storage-credentials threat this subsystem exists
for. We bind to the storage key rather than the document id because the document
row is created *after* the bytes are uploaded, so no document id exists at seal
time; the storage key already contains a uuid4 and is unique and unguessable.

NONCE MANAGEMENT
----------------
There is none, and that is the strongest argument for per-document DEKs. Each
DEK encrypts exactly one message: one key, one nonce, one message. The 2**32
birthday bound on random 96-bit IVs never comes into play because a given key is
never used twice. The nonce problem is eliminated by the key hierarchy rather
than managed by it.
"""

import hashlib
import hmac
import struct
import time
from typing import Final

from cryptography.exceptions import InvalidSignature, InvalidTag
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.crypto.errors import IntegrityError, UnsupportedFormatError
from app.crypto.zeroize import DEK_LENGTH

__all__ = [
    "ALG_AES256_GCM",
    "FORMAT_VERSION",
    "HEADER_LEN",
    "MAGIC",
    "EnvelopeHeader",
    "is_envelope",
    "object_size_for",
    "open_",
    "parse_header",
    "seal",
]

MAGIC: Final = b"TVENC\x00"
FORMAT_VERSION: Final = 0x01

#: AES-256-GCM over the whole plaintext in one shot.
ALG_AES256_GCM: Final = 0x01
#: Reserved for chunked streaming mode. Recognised, never produced, never opened.
ALG_AES256_GCM_CHUNKED: Final = 0x02

HEADER_LEN: Final = 96
NONCE_LEN: Final = 12
TAG_LEN: Final = 16
SIG_LEN: Final = 64
KEY_REF_LEN: Final = 16
SHA256_LEN: Final = 32

FLAG_SIGNED: Final = 1 << 0
FLAG_HAS_SHA256: Final = 1 << 1
_KNOWN_FLAGS: Final = FLAG_SIGNED | FLAG_HAS_SHA256

#: >  big-endian, no padding
#: 6s magic | B version | B alg | H header_len | I flags | 12s nonce
#: Q plaintext_len | 32s sha256 | 16s key_ref | Q created_at | H aad_ctx_len | I reserved
_HEADER_STRUCT: Final = struct.Struct(">6sBBHI12sQ32s16sQHI")

#: AAD domain separator. Bumping this string is a format break by design.
_AAD_CONTEXT_PREFIX: Final = b"tv1|"

#: GCM's own single-message ceiling is ~64 GB; this is an application invariant
#: far below it, enforced in the crypto layer so a future caller cannot bypass
#: the route-level size check and hand us something enormous.
MAX_PLAINTEXT_BYTES: Final = 256 * 1024 * 1024


class EnvelopeHeader:
    """A parsed, validated envelope header. Immutable."""

    __slots__ = (
        "alg_id",
        "created_at_unix",
        "flags",
        "format_version",
        "key_ref",
        "nonce",
        "plaintext_len",
        "plaintext_sha256",
        "raw",
    )

    def __init__(
        self,
        *,
        format_version: int,
        alg_id: int,
        flags: int,
        nonce: bytes,
        plaintext_len: int,
        plaintext_sha256: bytes,
        key_ref: bytes,
        created_at_unix: int,
        raw: bytes,
    ) -> None:
        self.format_version = format_version
        self.alg_id = alg_id
        self.flags = flags
        self.nonce = nonce
        self.plaintext_len = plaintext_len
        self.plaintext_sha256 = plaintext_sha256
        self.key_ref = key_ref
        self.created_at_unix = created_at_unix
        self.raw = raw

    @property
    def is_signed(self) -> bool:
        return bool(self.flags & FLAG_SIGNED)

    @property
    def object_size(self) -> int:
        """Exact total object length implied by this header."""
        return object_size_for(self.plaintext_len, signed=self.is_signed)

    def __repr__(self) -> str:  # pragma: no cover — debugging aid
        return (
            f"EnvelopeHeader(v{self.format_version}, alg={self.alg_id:#04x}, "
            f"plaintext_len={self.plaintext_len}, signed={self.is_signed}, "
            f"key_ref={self.key_ref.hex()})"
        )


def object_size_for(plaintext_len: int, *, signed: bool) -> int:
    """Total on-disk size of an envelope carrying ``plaintext_len`` bytes."""
    return HEADER_LEN + plaintext_len + TAG_LEN + (SIG_LEN if signed else 0)


def is_envelope(prefix: bytes) -> bool:
    """True if these leading bytes look like a TaxVault envelope.

    Used by the dual-read path to self-heal: a row marked ``encryption_version =
    0`` whose object nevertheless starts with our magic means a re-encryption
    sweep wrote the sealed object and then failed before committing the row.
    Trusting the bytes over the row is what makes that crash recoverable.
    """
    return prefix[: len(MAGIC)] == MAGIC


def compute_key_ref(wrapped_dek_ciphertext: bytes) -> bytes:
    """Fingerprint for matching an orphaned object back to its database row.

    Deliberately computed over the *wrapped* DEK, never the DEK itself: a
    fingerprint of live key material would be an oracle on that key. This one is
    a fingerprint of ciphertext an attacker who can read the object storage
    still cannot use.
    """
    return hashlib.sha256(wrapped_dek_ciphertext).digest()[:KEY_REF_LEN]


def _build_aad(header_bytes: bytes, storage_key: str) -> bytes:
    """AAD = the entire header, a separator, and the storage key.

    Authenticating the whole header means nobody can flip ``alg_id``, shrink
    ``plaintext_len``, or swap ``plaintext_sha256`` without the GCM tag failing.
    """
    return header_bytes + b"\x00" + _AAD_CONTEXT_PREFIX + storage_key.encode("utf-8")


def _pack_header(
    *,
    alg_id: int,
    flags: int,
    nonce: bytes,
    plaintext_len: int,
    plaintext_sha256: bytes,
    key_ref: bytes,
    created_at_unix: int,
) -> bytes:
    return _HEADER_STRUCT.pack(
        MAGIC,
        FORMAT_VERSION,
        alg_id,
        HEADER_LEN,
        flags,
        nonce,
        plaintext_len,
        plaintext_sha256,
        key_ref,
        created_at_unix,
        0,  # aad_ctx_len — context is reconstructed by the caller, never stored
        0,  # reserved
    )


def parse_header(obj: bytes) -> EnvelopeHeader:
    """Parse and validate the fixed 96-byte header.

    Raises ``UnsupportedFormatError`` for anything structurally wrong. Touches
    no key material, so it is safe to call on untrusted bytes before deciding
    whether to spend a KMS round-trip on them.
    """
    if len(obj) < HEADER_LEN:
        raise UnsupportedFormatError(
            f"Object is {len(obj)} bytes, shorter than the {HEADER_LEN}-byte header."
        )

    raw = obj[:HEADER_LEN]
    (
        magic,
        format_version,
        alg_id,
        header_len,
        flags,
        nonce,
        plaintext_len,
        plaintext_sha256,
        key_ref,
        created_at_unix,
        aad_ctx_len,
        reserved,
    ) = _HEADER_STRUCT.unpack(raw)

    if magic != MAGIC:
        raise UnsupportedFormatError(
            f"Bad magic {magic!r}: this is not a TaxVault encrypted object."
        )
    if format_version != FORMAT_VERSION:
        raise UnsupportedFormatError(
            f"Unsupported format version {format_version}; this build reads v{FORMAT_VERSION}."
        )
    if alg_id == ALG_AES256_GCM_CHUNKED:
        raise UnsupportedFormatError(
            "Chunked mode (alg_id 0x02) is reserved and not implemented in this build."
        )
    if alg_id != ALG_AES256_GCM:
        raise UnsupportedFormatError(f"Unknown algorithm id {alg_id:#04x}.")
    if header_len != HEADER_LEN:
        raise UnsupportedFormatError(
            f"Header claims {header_len} bytes; v{FORMAT_VERSION} headers are {HEADER_LEN}."
        )
    # Unknown flag bits mean a writer we do not understand. Refusing is the safe
    # direction: silently ignoring a bit could mean skipping a check it signals.
    if flags & ~_KNOWN_FLAGS:
        raise UnsupportedFormatError(f"Reserved flag bits set in {flags:#010x}.")
    if aad_ctx_len != 0:
        raise UnsupportedFormatError(
            f"aad_ctx_len is {aad_ctx_len}; v{FORMAT_VERSION} reconstructs context and stores none."
        )
    if reserved != 0:
        raise UnsupportedFormatError("Reserved header field is non-zero.")
    if plaintext_len > MAX_PLAINTEXT_BYTES:
        raise UnsupportedFormatError(
            f"Header claims {plaintext_len} plaintext bytes, above the "
            f"{MAX_PLAINTEXT_BYTES}-byte ceiling."
        )

    return EnvelopeHeader(
        format_version=format_version,
        alg_id=alg_id,
        flags=flags,
        nonce=nonce,
        plaintext_len=plaintext_len,
        plaintext_sha256=plaintext_sha256,
        key_ref=key_ref,
        created_at_unix=created_at_unix,
        raw=raw,
    )


def seal(
    *,
    plaintext: bytes,
    dek: bytes | bytearray,
    storage_key: str,
    wrapped_dek_ciphertext: bytes,
    signing_key: Ed25519PrivateKey | None = None,
    max_plaintext_bytes: int = MAX_PLAINTEXT_BYTES,
    _nonce: bytes | None = None,
    _created_at: int | None = None,
) -> bytes:
    """Encrypt ``plaintext`` into a complete envelope object.

    ``dek`` must be exactly 32 bytes and must never have been used before — the
    format's whole nonce story depends on one key encrypting one message.

    ``wrapped_dek_ciphertext`` is the KMS-wrapped form of that DEK; only its
    fingerprint is stored, so callers must wrap *before* sealing.

    ``signing_key`` is optional but strongly recommended. The signature does not
    defend against a compromised application server — that server holds both the
    signing key and the KEK, a residual risk this architecture accepts. It
    defends against a compromised storage provider or stolen bucket credentials:
    an attacker with write access cannot plant an object we will serve, not even
    a well-formed one, because they cannot forge the signature.

    ``_nonce`` and ``_created_at`` exist solely so the golden-vector test can pin
    a byte-exact header. Never pass them from application code.
    """
    if len(dek) != DEK_LENGTH:
        raise ValueError(f"DEK must be {DEK_LENGTH} bytes, got {len(dek)}.")
    if len(plaintext) > max_plaintext_bytes:
        # Refuse before allocating a ciphertext buffer, not after.
        raise ValueError(
            f"Plaintext is {len(plaintext)} bytes, above the {max_plaintext_bytes}-byte limit."
        )
    if not storage_key:
        raise ValueError("storage_key is required: it is bound into the AAD.")

    if _nonce is None:
        import os

        nonce = os.urandom(NONCE_LEN)
    else:
        if len(_nonce) != NONCE_LEN:
            raise ValueError(f"Nonce must be {NONCE_LEN} bytes, got {len(_nonce)}.")
        nonce = _nonce

    created_at = int(time.time()) if _created_at is None else _created_at

    flags = FLAG_HAS_SHA256
    if signing_key is not None:
        flags |= FLAG_SIGNED

    header = _pack_header(
        alg_id=ALG_AES256_GCM,
        flags=flags,
        nonce=nonce,
        plaintext_len=len(plaintext),
        plaintext_sha256=hashlib.sha256(plaintext).digest(),
        key_ref=compute_key_ref(wrapped_dek_ciphertext),
        created_at_unix=created_at,
    )

    # AESGCM copies the key into OpenSSL immediately; bytes(dek) is unavoidable
    # here and is one of the uncontrolled copies documented in zeroize.py.
    sealed = AESGCM(bytes(dek)).encrypt(nonce, plaintext, _build_aad(header, storage_key))

    body = header + sealed
    if signing_key is None:
        return body

    # Sign a digest of everything written so far, i.e. the object minus the
    # signature itself. Ed25519 hashes internally too; signing the digest keeps
    # the signed message a fixed 32 bytes regardless of document size.
    return body + signing_key.sign(hashlib.sha256(body).digest())


def open_(
    *,
    obj: bytes,
    dek: bytes | bytearray,
    storage_key: str,
    verify_key: Ed25519PublicKey | None = None,
    require_signature: bool = False,
) -> bytes:
    """Verify and decrypt an envelope object, returning the plaintext.

    Order of operations is deliberate and must not be rearranged:

      1. parse and validate the header (no key material touched)
      2. check the total object size against the header's own claim
      3. verify the Ed25519 signature, if present or required
      4. AES-GCM decrypt-and-verify with the storage-key-bound AAD
      5. recompute SHA-256 and compare in constant time
      6. only now return plaintext

    Step 4's tag already catches ciphertext truncation, but step 2 catches file
    truncation earlier, more cheaply, and with an error an operator can act on —
    and it stops us handing a short buffer to the AEAD.
    """
    header = parse_header(obj)

    expected = header.object_size
    if len(obj) != expected:
        raise IntegrityError(
            f"Object is {len(obj)} bytes; header implies {expected} "
            f"(plaintext_len={header.plaintext_len}, signed={header.is_signed}). "
            "Truncated, extended, or corrupt."
        )

    if header.is_signed:
        if verify_key is None:
            raise IntegrityError(
                "Object carries a signature but no verification key was supplied."
            )
        signed_part = obj[: expected - SIG_LEN]
        signature = obj[expected - SIG_LEN :]
        try:
            verify_key.verify(signature, hashlib.sha256(signed_part).digest())
        except InvalidSignature as exc:
            raise IntegrityError(
                "Ed25519 signature verification failed: the object was not written by this system."
            ) from exc
    elif require_signature:
        raise IntegrityError(
            "Unsigned object rejected because REQUIRE_OBJECT_SIGNATURE is enabled."
        )

    if len(dek) != DEK_LENGTH:
        raise ValueError(f"DEK must be {DEK_LENGTH} bytes, got {len(dek)}.")

    ct_end = HEADER_LEN + header.plaintext_len + TAG_LEN
    ciphertext_and_tag = obj[HEADER_LEN:ct_end]

    try:
        plaintext = AESGCM(bytes(dek)).decrypt(
            header.nonce,
            ciphertext_and_tag,
            _build_aad(header.raw, storage_key),
        )
    except InvalidTag as exc:
        # InvalidTag is a sibling of InvalidSignature, not a subclass — catching
        # the latter here would let every tamper case escape as an unhandled
        # exception. This is the single most important failure in the module: it
        # means the ciphertext, the header, the storage key, or the DEK does not
        # match what was sealed.
        raise IntegrityError(
            "AES-GCM authentication failed: wrong key, wrong storage key, or tampered object."
        ) from exc

    if header.flags & FLAG_HAS_SHA256 and not hmac.compare_digest(
        hashlib.sha256(plaintext).digest(), header.plaintext_sha256
    ):
        # Unreachable through GCM alone — the tag covers the ciphertext and the
        # header carries the hash. Kept as a belt-and-braces check against a
        # future format change that decouples them.
        raise IntegrityError("Plaintext SHA-256 does not match the value recorded at seal time.")

    return plaintext


# ---------------------------------------------------------------------------
# Reserved: chunked mode (alg_id 0x02). Specified, deliberately not built.
#
# Frame:  uint32 chunk_plaintext_len || ciphertext || 16-byte tag
#
# Per-chunk nonce is DETERMINISTIC: header.nonce[0:8] || uint32_be(chunk_index).
# Random per-chunk nonces would spend the birthday bound for nothing, when a
# counter is provably collision-free under a single-use key.
#
# Truncation is caught two ways: the high bit of chunk_plaintext_len marks the
# final chunk, AND each chunk's AAD includes uint32 chunk_index || uint8
# is_final. A stream truncated at a chunk boundary therefore fails because the
# final chunk never arrives, rather than merely looking short.
#
# Build this only if the upload cap rises far enough that holding a whole object
# in memory stops being reasonable. At 20 MB it buys nothing and costs an entire
# class of framing bugs.
# ---------------------------------------------------------------------------
