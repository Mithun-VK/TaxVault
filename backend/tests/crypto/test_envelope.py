"""Tests for the TaxVault envelope format.

The golden-vector test is the important one: it pins the exact 96 header bytes
for a fixed input, so any accidental change to the format — a reordered field, a
widened integer, a different AAD construction — fails loudly instead of silently
producing objects the previous build cannot open.
"""

import hashlib
import random

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.crypto.envelope import (
    FLAG_HAS_SHA256,
    FLAG_SIGNED,
    HEADER_LEN,
    MAGIC,
    SIG_LEN,
    TAG_LEN,
    compute_key_ref,
    is_envelope,
    object_size_for,
    open_,
    parse_header,
    seal,
)
from app.crypto.errors import IntegrityError, UnsupportedFormatError

DEK = bytes(range(32))
OTHER_DEK = bytes(range(100, 132))
WRAPPED = b"\xaa" * 40
KEY = "vault/library/itr/abc.tvenc"
OTHER_KEY = "vault/library/itr/def.tvenc"


def make(
    plaintext: bytes = b"hello",
    *,
    dek: bytes = DEK,
    storage_key: str = KEY,
    signing_key: Ed25519PrivateKey | None = None,
) -> bytes:
    return seal(
        plaintext=plaintext,
        dek=dek,
        storage_key=storage_key,
        wrapped_dek_ciphertext=WRAPPED,
        signing_key=signing_key,
    )


# --------------------------------------------------------------------------
# Golden vector — the format-change tripwire
# --------------------------------------------------------------------------

GOLDEN_PLAINTEXT = b"TaxVault golden vector"
GOLDEN_NONCE = bytes(range(12))
GOLDEN_CREATED_AT = 1750000000
GOLDEN_HEADER_HEX = (
    "5456454e43000101006000000002"  # magic | v1 | alg1 | header_len 96 | flags 2
    "000102030405060708090a0b"  # nonce
    "0000000000000016"  # plaintext_len = 22
    "7eef489b8e0aa2103af0ab19ce8206c431cfd2c97fe44872d4cbe79c26f506aa"  # sha256
    "1f800eec61b824973f76067fcc2e1f67"  # key_ref
    "00000000684ee180"  # created_at = 1750000000
    "0000"  # aad_ctx_len
    "00000000"  # reserved
)


def test_golden_header_is_byte_exact() -> None:
    obj = seal(
        plaintext=GOLDEN_PLAINTEXT,
        dek=DEK,
        storage_key=KEY,
        wrapped_dek_ciphertext=WRAPPED,
        _nonce=GOLDEN_NONCE,
        _created_at=GOLDEN_CREATED_AT,
    )
    assert obj[:HEADER_LEN].hex() == GOLDEN_HEADER_HEX
    assert len(obj) == HEADER_LEN + len(GOLDEN_PLAINTEXT) + TAG_LEN == 134


def test_golden_header_fields_decode() -> None:
    obj = seal(
        plaintext=GOLDEN_PLAINTEXT,
        dek=DEK,
        storage_key=KEY,
        wrapped_dek_ciphertext=WRAPPED,
        _nonce=GOLDEN_NONCE,
        _created_at=GOLDEN_CREATED_AT,
    )
    h = parse_header(obj)
    assert h.format_version == 1
    assert h.alg_id == 1
    assert h.flags == FLAG_HAS_SHA256
    assert h.is_signed is False
    assert h.nonce == GOLDEN_NONCE
    assert h.plaintext_len == len(GOLDEN_PLAINTEXT)
    assert h.plaintext_sha256 == hashlib.sha256(GOLDEN_PLAINTEXT).digest()
    assert h.key_ref == compute_key_ref(WRAPPED)
    assert h.created_at_unix == GOLDEN_CREATED_AT
    assert h.object_size == len(obj)


def test_key_ref_fingerprints_the_wrapped_key_never_the_dek() -> None:
    """A fingerprint of live key material would be an oracle on that key."""
    ref = compute_key_ref(WRAPPED)
    assert ref == hashlib.sha256(WRAPPED).digest()[:16]
    assert ref != hashlib.sha256(DEK).digest()[:16]
    assert DEK not in ref


# --------------------------------------------------------------------------
# Round-trip
# --------------------------------------------------------------------------


@pytest.mark.parametrize("size", [0, 1, 15, 16, 17, 4095, 4096, 4097, 1_000_000])
def test_roundtrip_sizes(size: int) -> None:
    plaintext = bytes(random.getrandbits(8) for _ in range(min(size, 4097))) * (
        1 + size // 4098
    )
    plaintext = plaintext[:size]
    obj = make(plaintext)
    assert open_(obj=obj, dek=DEK, storage_key=KEY) == plaintext


def test_roundtrip_accepts_bytearray_dek() -> None:
    """DEKs travel as bytearray so they can be zeroed; both forms must work."""
    obj = seal(
        plaintext=b"x", dek=bytearray(DEK), storage_key=KEY, wrapped_dek_ciphertext=WRAPPED
    )
    assert open_(obj=obj, dek=bytearray(DEK), storage_key=KEY) == b"x"


def test_roundtrip_property_seeded() -> None:
    """Randomised round-trip over sizes and contents.

    A seeded loop rather than Hypothesis, which is not installed here. Add
    `hypothesis` as a dev dependency and replace this with
    `@given(st.binary(max_size=100_000))` when convenient — it is strictly
    better at finding boundary cases.
    """
    rng = random.Random(0xC0FFEE)
    for _ in range(200):
        n = rng.choice([0, 1, rng.randrange(2, 64), rng.randrange(64, 8192)])
        plaintext = rng.randbytes(n)
        key = f"vault/{rng.randrange(10**9)}/x.tvenc"
        dek = rng.randbytes(32)
        obj = seal(
            plaintext=plaintext, dek=dek, storage_key=key, wrapped_dek_ciphertext=WRAPPED
        )
        assert open_(obj=obj, dek=dek, storage_key=key) == plaintext


def test_ciphertext_does_not_contain_plaintext() -> None:
    """The point of the whole exercise."""
    secret = b"AADHAAR 1234 5678 9012 Ravi Kumar"
    obj = make(secret)
    assert secret not in obj
    assert b"Ravi" not in obj
    assert obj.startswith(MAGIC)


def test_nonce_differs_between_seals() -> None:
    a = parse_header(make(b"same")).nonce
    b = parse_header(make(b"same")).nonce
    assert a != b


# --------------------------------------------------------------------------
# Tamper detection
# --------------------------------------------------------------------------

# Every header field offset, plus the first/last ciphertext byte and the tag.
_PLAINTEXT_FOR_TAMPER = b"tamper me" * 4  # 36 bytes
_TAMPER_OFFSETS = [
    *range(0, HEADER_LEN),  # every header byte
    HEADER_LEN,  # first ciphertext byte
    HEADER_LEN + 35,  # last ciphertext byte
    HEADER_LEN + 36,  # first tag byte
    HEADER_LEN + 36 + 15,  # last tag byte
]


@pytest.mark.parametrize("offset", _TAMPER_OFFSETS)
def test_single_flipped_bit_is_always_detected(offset: int) -> None:
    """No byte of the object may be changed without a raise.

    Both error types are acceptable outcomes — a corrupt magic byte is an
    UnsupportedFormatError, a corrupt nonce is an IntegrityError — but returning
    plaintext never is.
    """
    obj = bytearray(make(_PLAINTEXT_FOR_TAMPER))
    obj[offset] ^= 0x01
    with pytest.raises((IntegrityError, UnsupportedFormatError)):
        open_(obj=bytes(obj), dek=DEK, storage_key=KEY)


def test_wrong_dek_is_detected() -> None:
    obj = make(b"secret")
    with pytest.raises(IntegrityError):
        open_(obj=obj, dek=OTHER_DEK, storage_key=KEY)


def test_wrong_storage_key_is_detected() -> None:
    """The cut-and-paste test.

    An attacker with object-storage write access swaps the bytes at key A onto
    key B, leaving the database untouched. Binding the storage key into the AAD
    is what makes that fail; the wrapped DEK in the row alone would not.
    """
    obj = make(b"secret", storage_key=KEY)
    with pytest.raises(IntegrityError):
        open_(obj=obj, dek=DEK, storage_key=OTHER_KEY)


def test_swapping_two_objects_fails_both_ways() -> None:
    a = make(b"document A", storage_key=KEY)
    b = make(b"document B", storage_key=OTHER_KEY)
    with pytest.raises(IntegrityError):
        open_(obj=a, dek=DEK, storage_key=OTHER_KEY)
    with pytest.raises(IntegrityError):
        open_(obj=b, dek=DEK, storage_key=KEY)


@pytest.mark.parametrize("drop", [1, 16, 17, 64])
def test_truncation_is_detected(drop: int) -> None:
    obj = make(b"x" * 128)
    with pytest.raises((IntegrityError, UnsupportedFormatError)):
        open_(obj=obj[:-drop], dek=DEK, storage_key=KEY)


def test_extension_is_detected() -> None:
    obj = make(b"x" * 32)
    with pytest.raises(IntegrityError, match="header implies"):
        open_(obj=obj + b"\x00", dek=DEK, storage_key=KEY)


def test_size_mismatch_is_caught_before_crypto() -> None:
    """A legible operator-facing error, raised before the AEAD sees a short buffer."""
    obj = make(b"x" * 100)
    with pytest.raises(IntegrityError, match="Truncated, extended, or corrupt"):
        open_(obj=obj[:-5], dek=DEK, storage_key=KEY)


# --------------------------------------------------------------------------
# Header validation
# --------------------------------------------------------------------------


def test_missing_header_is_unsupported_not_integrity() -> None:
    with pytest.raises(UnsupportedFormatError, match="shorter than"):
        open_(obj=b"too short", dek=DEK, storage_key=KEY)


def test_plaintext_object_is_rejected_as_unsupported() -> None:
    """Legacy plaintext objects have no header at all — the dual-read path must
    distinguish 'not one of ours' from 'corrupt'."""
    with pytest.raises(UnsupportedFormatError, match="Bad magic"):
        parse_header(b"%PDF-1.7" + b"\x00" * 200)


def test_reserved_chunked_alg_is_named_in_the_error() -> None:
    obj = bytearray(make(b"x"))
    obj[7] = 0x02
    with pytest.raises(UnsupportedFormatError, match="Chunked mode"):
        parse_header(bytes(obj))


def test_unknown_flag_bits_are_rejected() -> None:
    """Refusing is the safe direction: an unknown bit may signal a check we skip."""
    obj = bytearray(make(b"x"))
    obj[10] = 0x80  # top byte of the big-endian flags word
    with pytest.raises(UnsupportedFormatError, match="Reserved flag bits"):
        parse_header(bytes(obj))


def test_nonzero_reserved_field_is_rejected() -> None:
    obj = bytearray(make(b"x"))
    obj[95] = 0x01
    with pytest.raises(UnsupportedFormatError, match="Reserved header field"):
        parse_header(bytes(obj))


def test_future_format_version_is_rejected() -> None:
    obj = bytearray(make(b"x"))
    obj[6] = 0x02
    with pytest.raises(UnsupportedFormatError, match="Unsupported format version"):
        parse_header(bytes(obj))


def test_is_envelope_discriminates() -> None:
    assert is_envelope(make(b"x")) is True
    assert is_envelope(b"%PDF-1.7 ...") is False
    assert is_envelope(b"") is False
    assert is_envelope(MAGIC) is True


def test_object_size_for_matches_reality() -> None:
    assert len(make(b"x" * 500)) == object_size_for(500, signed=False)
    sk = Ed25519PrivateKey.generate()
    assert len(make(b"x" * 500, signing_key=sk)) == object_size_for(500, signed=True)


# --------------------------------------------------------------------------
# Ed25519 signature
# --------------------------------------------------------------------------


def test_signed_roundtrip() -> None:
    sk = Ed25519PrivateKey.generate()
    obj = make(b"signed payload", signing_key=sk)
    header = parse_header(obj)
    assert header.is_signed
    assert header.flags & FLAG_SIGNED
    assert open_(obj=obj, dek=DEK, storage_key=KEY, verify_key=sk.public_key()) == (
        b"signed payload"
    )


def test_signed_object_without_verify_key_is_refused() -> None:
    sk = Ed25519PrivateKey.generate()
    obj = make(b"signed", signing_key=sk)
    with pytest.raises(IntegrityError, match="no verification key"):
        open_(obj=obj, dek=DEK, storage_key=KEY)


def test_wrong_signing_key_is_detected() -> None:
    """The defence against a compromised object store: an attacker with bucket
    write access cannot plant an object we will serve."""
    obj = make(b"signed", signing_key=Ed25519PrivateKey.generate())
    with pytest.raises(IntegrityError, match="signature verification failed"):
        open_(
            obj=obj,
            dek=DEK,
            storage_key=KEY,
            verify_key=Ed25519PrivateKey.generate().public_key(),
        )


@pytest.mark.parametrize("sig_offset", [0, 31, 63])
def test_flipped_signature_byte_is_detected(sig_offset: int) -> None:
    sk = Ed25519PrivateKey.generate()
    obj = bytearray(make(b"signed", signing_key=sk))
    obj[len(obj) - SIG_LEN + sig_offset] ^= 0x01
    with pytest.raises(IntegrityError, match="signature verification failed"):
        open_(obj=bytes(obj), dek=DEK, storage_key=KEY, verify_key=sk.public_key())


def test_stripping_the_signature_is_detected() -> None:
    """Downgrade attack: drop the signature and clear the flag."""
    sk = Ed25519PrivateKey.generate()
    obj = bytearray(make(b"signed", signing_key=sk))
    stripped = bytearray(obj[:-SIG_LEN])
    stripped[13] &= ~FLAG_SIGNED  # low byte of the big-endian flags word
    with pytest.raises(IntegrityError):
        open_(obj=bytes(stripped), dek=DEK, storage_key=KEY, verify_key=sk.public_key())


def test_require_signature_rejects_unsigned_objects() -> None:
    obj = make(b"unsigned")
    with pytest.raises(IntegrityError, match="REQUIRE_OBJECT_SIGNATURE"):
        open_(obj=obj, dek=DEK, storage_key=KEY, require_signature=True)


def test_require_signature_allows_signed_objects() -> None:
    sk = Ed25519PrivateKey.generate()
    obj = make(b"signed", signing_key=sk)
    assert (
        open_(
            obj=obj,
            dek=DEK,
            storage_key=KEY,
            verify_key=sk.public_key(),
            require_signature=True,
        )
        == b"signed"
    )


# --------------------------------------------------------------------------
# Input validation
# --------------------------------------------------------------------------


@pytest.mark.parametrize("bad_len", [0, 16, 31, 33, 64])
def test_seal_rejects_wrong_dek_length(bad_len: int) -> None:
    with pytest.raises(ValueError, match="DEK must be 32 bytes"):
        seal(
            plaintext=b"x",
            dek=b"\x00" * bad_len,
            storage_key=KEY,
            wrapped_dek_ciphertext=WRAPPED,
        )


def test_seal_rejects_empty_storage_key() -> None:
    with pytest.raises(ValueError, match="storage_key is required"):
        seal(plaintext=b"x", dek=DEK, storage_key="", wrapped_dek_ciphertext=WRAPPED)


def test_seal_refuses_oversize_before_allocating() -> None:
    with pytest.raises(ValueError, match="above the"):
        seal(
            plaintext=b"x" * 101,
            dek=DEK,
            storage_key=KEY,
            wrapped_dek_ciphertext=WRAPPED,
            max_plaintext_bytes=100,
        )


def test_seal_rejects_wrong_nonce_length() -> None:
    with pytest.raises(ValueError, match="Nonce must be 12 bytes"):
        seal(
            plaintext=b"x",
            dek=DEK,
            storage_key=KEY,
            wrapped_dek_ciphertext=WRAPPED,
            _nonce=b"\x00" * 8,
        )


def test_header_claiming_absurd_plaintext_length_is_rejected_cheaply() -> None:
    """A hostile header must not make us try to allocate 2**64 bytes."""
    obj = bytearray(make(b"x"))
    obj[26:34] = (2**63).to_bytes(8, "big")
    with pytest.raises(UnsupportedFormatError, match="ceiling"):
        parse_header(bytes(obj))
