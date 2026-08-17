"""Resolve the configured key-management provider.

Mirrors ``app.notifications.factory``: ``@lru_cache(maxsize=1)``, a deferred
settings import so the module can be imported before configuration is valid, and
a module-scoped logger. Tests call ``get_kms.cache_clear()``.
"""

import logging
from functools import lru_cache

from app.crypto.errors import KmsConfigurationError
from app.crypto.kms.base import KeyManagementProvider

logger = logging.getLogger("taxvault.crypto")

__all__ = ["KMS_PROVIDERS", "get_kms"]

#: Every provider name the configuration validator will accept.
KMS_PROVIDERS = ("local", "vault_transit", "pkcs11")


@lru_cache(maxsize=1)
def get_kms() -> KeyManagementProvider:
    from app.core.config import settings

    provider = settings.KMS_PROVIDER

    if provider == "local":
        from app.crypto.kms.providers.local import LocalKmsProvider

        kms = LocalKmsProvider.from_settings(settings)
        logger.info(
            "kms_provider_initialised: provider=local versions=%s",
            kms.configured_versions,
        )
        return kms

    if provider == "vault_transit":
        from app.crypto.kms.providers.vault_transit import VaultTransitKmsProvider

        kms_vault = VaultTransitKmsProvider.from_settings(settings)
        logger.info(
            "kms_provider_initialised: provider=vault_transit addr=%s mount=%s key=%s",
            settings.VAULT_ADDR,
            settings.VAULT_TRANSIT_MOUNT,
            settings.VAULT_TRANSIT_KEY,
        )
        return kms_vault

    if provider == "pkcs11":
        from app.crypto.kms.providers.pkcs11 import Pkcs11KmsProvider

        return Pkcs11KmsProvider()  # raises: interface only

    raise KmsConfigurationError(
        f"Unknown KMS_PROVIDER {provider!r}. Valid values: {', '.join(KMS_PROVIDERS)}."
    )
