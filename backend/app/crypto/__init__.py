"""Cryptographic core: envelope encryption, key management, field encryption.

This package knows nothing about HTTP, SQLAlchemy, or storage backends. It
takes bytes and keys and returns bytes, which is what makes it testable against
published known-answer vectors with no fixtures.

Composition happens in ``app.services.blob_service``, which pairs this package
with ``app.storage``.
"""

from app.crypto.errors import (
    CryptoError,
    IntegrityError,
    KmsAuthError,
    KmsConfigurationError,
    KmsError,
    KmsUnavailableError,
    UnsupportedFormatError,
)

__all__ = [
    "CryptoError",
    "IntegrityError",
    "KmsAuthError",
    "KmsConfigurationError",
    "KmsError",
    "KmsUnavailableError",
    "UnsupportedFormatError",
]
