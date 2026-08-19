"""Known-answer tests for the primitives the envelope format is built on.

These pin AES-256-GCM and AES-KW against published vectors. They do not test our
code so much as they prove the library underneath us behaves as the standards
say - which is what lets every other test in this directory trust it. If one of
these ever fails, the problem is the environment (a swapped OpenSSL, a broken
build), not the envelope format.

Sources:
  * AES-GCM: McGrew & Viega, "The Galois/Counter Mode of Operation (GCM)",
    test cases 13-16 (the AES-256 set), reproduced in NIST's CAVP material.
  * AES-KW:  RFC 3394 section 4.6, "Wrap 256 bits of Key Data with a 256-bit KEK".
"""

import pytest
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.keywrap import (
    InvalidUnwrap,
    aes_key_unwrap,
    aes_key_wrap,
)


def h(s: str) -> bytes:
    return bytes.fromhex(s)


# --------------------------------------------------------------------------
# AES-256-GCM
# --------------------------------------------------------------------------

_ZERO_KEY = "00" * 32
_TC_KEY = "feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308"
_TC_IV = "cafebabefacedbaddecaf888"

# Test case 15 uses the full 64-byte plaintext; test case 16 truncates it to 60
# and adds AAD. Because GCM is CTR-based, tc16's ciphertext is byte-for-byte the
# first 60 bytes of tc15's - which makes it easy to pair the wrong tag with the
# wrong plaintext. The two are kept explicitly separate here for that reason.
_TC15_PT = (
    "d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a72"
    "1c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b391aafd255"
)
_TC15_CT = (
    "522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa"
    "8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662898015ad"
)
_TC16_PT = _TC15_PT[: 60 * 2]
_TC16_CT = _TC15_CT[: 60 * 2]
_TC16_AAD = "feedfacedeadbeeffeedfacedeadbeefabaddad2"
_TC16_TAG = "76fc6ece0f4e1768cddf8853bb2d551b"

# id, key, iv, plaintext, aad, ciphertext, tag
GCM_VECTORS = [
    # Test case 13: empty plaintext, empty AAD. Proves the tag covers "nothing"
    # correctly, which is the case our zero-byte-document test exercises.
    ("tc13-empty", _ZERO_KEY, "00" * 12, "", "", "", "530f8afbc74536b9a963b4f1c4cb738b"),
    # Test case 14: one block, no AAD.
    (
        "tc14-one-block",
        _ZERO_KEY,
        "00" * 12,
        "00" * 16,
        "",
        "cea7403d4d606b6e074ec5d3baf39d18",
        "d0d1c8a799996bf0265b98b5d48ab919",
    ),
    # Test case 15: 64 bytes, no AAD - multi-block.
    (
        "tc15-multiblock",
        _TC_KEY,
        _TC_IV,
        _TC15_PT,
        "",
        _TC15_CT,
        "b094dac5d93471bdec1a502270e3cc6c",
    ),
    # Test case 16: same key/IV, plaintext truncated to a non-block-aligned 60
    # bytes, and AAD added. The ciphertext is tc15's first 60 bytes but the tag
    # differs - which is precisely the property our format relies on when it
    # binds the header and the storage key into the AAD.
    ("tc16-with-aad", _TC_KEY, _TC_IV, _TC16_PT, _TC16_AAD, _TC16_CT, _TC16_TAG),
]


@pytest.mark.parametrize(("name", "key", "iv", "pt", "aad", "ct", "tag"), GCM_VECTORS)
def test_gcm_encrypt_matches_published_vector(
    name: str, key: str, iv: str, pt: str, aad: str, ct: str, tag: str
) -> None:
    # cryptography returns ciphertext||tag concatenated, which is also our
    # on-object layout.
    got = AESGCM(h(key)).encrypt(h(iv), h(pt), h(aad) or None)
    assert got == h(ct) + h(tag), f"{name}: ciphertext||tag mismatch"


@pytest.mark.parametrize(("name", "key", "iv", "pt", "aad", "ct", "tag"), GCM_VECTORS)
def test_gcm_decrypt_matches_published_vector(
    name: str, key: str, iv: str, pt: str, aad: str, ct: str, tag: str
) -> None:
    got = AESGCM(h(key)).decrypt(h(iv), h(ct) + h(tag), h(aad) or None)
    assert got == h(pt), f"{name}: plaintext mismatch"


def test_gcm_rejects_wrong_aad() -> None:
    """AAD is authenticated: the right ciphertext with the wrong AAD must fail.

    This is the primitive-level version of our cut-and-paste defence - the
    envelope binds its header and storage key into exactly this slot.
    """
    key, iv = h(_TC_KEY), h(_TC_IV)
    tc16 = h(_TC16_CT) + h(_TC16_TAG)

    assert AESGCM(key).decrypt(iv, tc16, h(_TC16_AAD)) == h(_TC16_PT)

    flipped = bytearray(h(_TC16_AAD))
    flipped[-1] ^= 0x01
    with pytest.raises(InvalidTag):
        AESGCM(key).decrypt(iv, tc16, bytes(flipped))
    with pytest.raises(InvalidTag):
        AESGCM(key).decrypt(iv, tc16, None)


def test_gcm_rejects_truncated_tag() -> None:
    key, iv = h(_ZERO_KEY), h("00" * 12)
    full = AESGCM(key).encrypt(iv, b"", None)
    with pytest.raises(InvalidTag):
        AESGCM(key).decrypt(iv, full[:-1], None)


def test_gcm_rejects_flipped_tag_bit() -> None:
    key, iv = h(_ZERO_KEY), h("00" * 12)
    sealed = bytearray(AESGCM(key).encrypt(iv, b"hello", None))
    sealed[-1] ^= 0x01
    with pytest.raises(InvalidTag):
        AESGCM(key).decrypt(iv, bytes(sealed), None)


# --------------------------------------------------------------------------
# AES Key Wrap (RFC 3394) - how LocalKmsProvider wraps every DEK
# --------------------------------------------------------------------------

# RFC 3394 section 4.6
KW_KEK = "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"
KW_KEY = "00112233445566778899AABBCCDDEEFF000102030405060708090A0B0C0D0E0F"
KW_EXPECTED = (
    "28C9F404C4B810F4CBCCB35CFB87F8263F5786E2D80ED326CBC7F0E71A99F43BFB988B9B7A02DD21"
)


def test_aes_kw_matches_rfc3394_section_4_6() -> None:
    assert aes_key_wrap(h(KW_KEK), h(KW_KEY)) == h(KW_EXPECTED)


def test_aes_kw_roundtrip() -> None:
    assert aes_key_unwrap(h(KW_KEK), h(KW_EXPECTED)) == h(KW_KEY)


def test_aes_kw_is_deterministic() -> None:
    """No nonce, by design: the long-lived KEK wraps every DEK in the system,
    which is exactly where a 96-bit random nonce and its birthday bound are
    unwelcome."""
    assert aes_key_wrap(h(KW_KEK), h(KW_KEY)) == aes_key_wrap(h(KW_KEK), h(KW_KEY))


def test_aes_kw_wrapping_32_bytes_yields_40() -> None:
    """Sizing check for the enc_wrapped_dek BYTEA column."""
    assert len(aes_key_wrap(h(KW_KEK), h(KW_KEY))) == 40


@pytest.mark.parametrize("bit_index", [0, 7, 8, 100, 255, 319])
def test_aes_kw_rejects_single_flipped_bit(bit_index: int) -> None:
    wrapped = bytearray(h(KW_EXPECTED))
    wrapped[bit_index // 8] ^= 1 << (bit_index % 8)
    with pytest.raises(InvalidUnwrap):
        aes_key_unwrap(h(KW_KEK), bytes(wrapped))


def test_aes_kw_rejects_wrong_kek() -> None:
    with pytest.raises(InvalidUnwrap):
        aes_key_unwrap(b"\x01" * 32, h(KW_EXPECTED))
