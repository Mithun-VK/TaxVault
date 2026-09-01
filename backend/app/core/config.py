from typing import Annotated

from pydantic import ValidationInfo, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────
    APP_NAME: str = "TaxVault"
    ENVIRONMENT: str = "development"  # development | staging | production
    DEBUG: bool = False
    VERSION: str = "1.0.0"

    # ── Security ─────────────────────────────────────────────
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    RESET_TOKEN_EXPIRE_MINUTES: int = 60
    ALGORITHM: str = "HS256"

    # How long a member's edit/delete request waits for an admin before it
    # expires. Expiry is evaluated whenever the queue is read or reviewed, so
    # changing this takes effect immediately for requests already in flight.
    CHANGE_REQUEST_TTL_MINUTES: int = 15

    # ── Serverless cron (Vercel) ─────────────────────────────
    # Guards /api/v1/cron/*. Those routes replace Celery beat's daily-alert-scan
    # and overdue-check on a deployment with no worker process - see
    # app/api/v1/cron.py. Blank in self-hosted/Docker deployments, which still
    # run the real Celery beat schedule and never hit these routes.
    CRON_SECRET: str = ""

    # ── CORS ─────────────────────────────────────────────────
    # NoDecode: parse comma-separated env strings ourselves (not JSON).
    CORS_ORIGINS: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    FRONTEND_URL: str = "http://localhost:5173"

    # ── Database ─────────────────────────────────────────────
    DATABASE_URL: str
    DIRECT_DATABASE_URL: str
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE: int = 300  # seconds

    # ── Redis ────────────────────────────────────────────────
    REDIS_URL: str
    ENABLE_TOKEN_BLOCKLIST: bool = True
    TOKEN_BLOCKLIST_TTL: int = 60 * 60 * 24 * 8  # 8 days

    # ── Cloudflare R2 (S3-compatible) ────────────────────────
    R2_ENDPOINT: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "taxvault-docs"
    R2_PRESIGN_EXPIRY: int = 900  # 15 minutes

    # ── Local storage fallback ───────────────────────────────
    # When R2 is not configured, documents are stored on the backend's local
    # disk under this directory and served via /api/v1/documents/blob/*.
    # Relative paths resolve against the backend working directory.
    LOCAL_STORAGE_DIR: str = "uploads"

    MAX_UPLOAD_SIZE_MB: int = 20
    ALLOWED_MIME_TYPES: Annotated[list[str], NoDecode] = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]

    # ── AWS SES ──────────────────────────────────────────────
    AWS_REGION: str = "ap-south-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    EMAIL_FROM: str = "noreply@taxvault.in"
    EMAIL_FROM_NAME: str = "TaxVault"

    # ── MSG91 SMS ────────────────────────────────────────────
    MSG91_AUTH_KEY: str = ""
    MSG91_SENDER_ID: str = "TXVALT"
    MSG91_TEMPLATE_ID: str = ""
    MSG91_API_URL: str = "https://control.msg91.com/api/v5/flow/"

    # ── Twilio WhatsApp ──────────────────────────────────────
    # The primary alert channel. TWILIO_WHATSAPP_FROM is the Twilio sender (the
    # sandbox number during testing); TWILIO_WHATSAPP_TO is the household number
    # every reminder goes to. Leave TO blank to fall back to each user's own
    # phone_number instead. Numbers are plain E.164 here (+919876543210) - the
    # "whatsapp:" prefix Twilio wants is added by the channel.
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = ""
    TWILIO_WHATSAPP_TO: str = ""
    TWILIO_API_URL: str = "https://api.twilio.com/2010-04-01"

    # ── Firebase FCM ─────────────────────────────────────────
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "./firebase-service-account.json"

    # ── Sentry ───────────────────────────────────────────────
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    SENTRY_PROFILES_SAMPLE_RATE: float = 0.1

    # ── Envelope encryption ──────────────────────────────────
    # Documents are encrypted with a per-document AES-256-GCM key, which is
    # itself wrapped by the configured key-management provider. See
    # app/crypto/README or app/crypto/envelope.py for the object format.
    ENCRYPTION_ENABLED: bool = True
    KMS_PROVIDER: str = "local"  # local | vault_transit | pkcs11

    # "version:base64url_32_bytes" entries; highest version wraps, all unwrap.
    # Deliberately NOT derived from SECRET_KEY: rotating a JWT signing key must
    # never make stored documents undecryptable.
    ENCRYPTION_MASTER_KEYS: Annotated[list[str], NoDecode] = []

    # Dual-read escape hatch for documents uploaded before encryption existed.
    # Flip to False once the re-encryption sweep reports zero version-0 rows.
    ALLOW_PLAINTEXT_DOCUMENTS: bool = True

    # Ed25519 object signing. Defends against a compromised object store, not a
    # compromised app server. Seed is base64url 32 bytes; derived if blank.
    DOCUMENT_SIGNING_KEY: str = ""
    REQUIRE_OBJECT_SIGNATURE: bool = False

    # Short-lived tokens in blob URLs, because <img src> and window.open cannot
    # carry an Authorization header. The short TTL is what makes a token in a
    # URL acceptable despite URLs leaking into Referer, history and proxy logs.
    DOWNLOAD_TOKEN_TTL_SECONDS: int = 120
    DOWNLOAD_TOKEN_SINGLE_USE: bool = False
    UPLOAD_TICKET_TTL_SECONDS: int = 900

    REENCRYPT_BATCH_SIZE: int = 25
    REENCRYPT_KEEP_ORIGINAL_DAYS: int = 14

    # ── HashiCorp Vault Transit (KMS_PROVIDER=vault_transit) ──
    VAULT_ADDR: str = ""
    VAULT_TOKEN: str = ""
    VAULT_TRANSIT_MOUNT: str = "transit"
    VAULT_TRANSIT_KEY: str = "taxvault-dek"
    VAULT_NAMESPACE: str = ""
    VAULT_TIMEOUT_SECONDS: float = 5.0
    VAULT_VERIFY_TLS: bool = True

    # ── Rate Limiting ────────────────────────────────────────
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_REGISTER: str = "3/minute"
    RATE_LIMIT_FORGOT_PASSWORD: str = "3/minute"
    RATE_LIMIT_GLOBAL: str = "200/minute"

    # ── Validators ───────────────────────────────────────────
    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info: ValidationInfo) -> str:
        env = info.data.get("ENVIRONMENT", "development")
        if env == "production":
            if not v or len(v) < 32 or v.startswith("change"):
                raise ValueError(
                    "SECRET_KEY must be a strong random string (>=32 chars) in production. "
                    'Generate with: python -c "import secrets; print(secrets.token_hex(32))"'
                )
        return v

    @field_validator("ENCRYPTION_MASTER_KEYS")
    @classmethod
    def validate_master_keys(cls, v: list[str]) -> list[str]:
        """Reject malformed master keys at startup, never at first download.

        A typo here is unrecoverable data loss, so it must surface while the
        operator is still looking at the console.
        """
        if v:
            # Imported lazily: app.crypto must not be a hard dependency of
            # loading configuration.
            from app.crypto.kms.providers.local import parse_master_keys

            parse_master_keys(v)
        return v

    @field_validator("CORS_ORIGINS", "ALLOWED_MIME_TYPES", "ENCRYPTION_MASTER_KEYS", mode="before")
    @classmethod
    def parse_csv_list(cls, v: "str | list[str]") -> list[str]:
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v.startswith("postgresql"):
            raise ValueError("DATABASE_URL must be a PostgreSQL connection string")
        return v

    @model_validator(mode="after")
    def validate_encryption_fails_closed(self) -> "Settings":
        """Cross-field checks that stop an insecure deployment from booting.

        Deliberately NOT enforced here: ALLOW_PLAINTEXT_DOCUMENTS being True in
        production. Refusing that would make the rollout itself impossible,
        since the whole point of dual-read is to serve legacy objects while the
        sweep runs. Startup logs the live count of version-0 rows instead, so
        ops closes that loop rather than configuration blocking it.
        """
        if self.KMS_PROVIDER not in ("local", "vault_transit", "pkcs11"):
            raise ValueError(
                f"KMS_PROVIDER must be one of local, vault_transit, pkcs11 - "
                f"got {self.KMS_PROVIDER!r}."
            )
        if self.KMS_PROVIDER == "pkcs11":
            raise ValueError(
                "KMS_PROVIDER='pkcs11' is an interface only in this release. "
                "Use 'local' or 'vault_transit'."
            )
        if self.DOWNLOAD_TOKEN_TTL_SECONDS > 900:
            raise ValueError(
                "DOWNLOAD_TOKEN_TTL_SECONDS must be <= 900. A long-lived token in a "
                "URL is the exact failure mode this design exists to avoid."
            )

        if not self.is_production:
            return self

        if not self.ENCRYPTION_ENABLED:
            raise ValueError("ENCRYPTION_ENABLED cannot be False in production.")
        if self.KMS_PROVIDER == "local" and not self.ENCRYPTION_MASTER_KEYS:
            raise ValueError(
                "ENCRYPTION_MASTER_KEYS is required in production. Refusing to derive a "
                "master key from SECRET_KEY: rotating SECRET_KEY would make every stored "
                'document permanently undecryptable. Generate one with:\n'
                '  python -c "import secrets,base64; '
                "print('1:'+base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())\""
            )
        if self.KMS_PROVIDER == "vault_transit":
            if not (self.VAULT_ADDR and self.VAULT_TOKEN):
                raise ValueError(
                    "VAULT_ADDR and VAULT_TOKEN are required when KMS_PROVIDER=vault_transit."
                )
            if not self.VAULT_VERIFY_TLS:
                raise ValueError("VAULT_VERIFY_TLS cannot be disabled in production.")
            if self.VAULT_ADDR.startswith("http://"):
                raise ValueError(
                    "VAULT_ADDR must use https in production - a plaintext Vault "
                    "connection carries unwrapped DEKs over the network."
                )
        return self

    # ── Computed properties ──────────────────────────────────
    @property
    def encryption_configured(self) -> bool:
        """True when documents will actually be encrypted at rest.

        Mirrors r2_configured's role: a single expression the rest of the app
        can branch on without re-deriving the provider rules.
        """
        if not self.ENCRYPTION_ENABLED:
            return False
        if self.KMS_PROVIDER == "vault_transit":
            return bool(self.VAULT_ADDR and self.VAULT_TOKEN)
        if self.KMS_PROVIDER == "local":
            # A development deployment with no master keys still encrypts, using
            # a key derived from SECRET_KEY. Production is blocked above.
            return bool(self.ENCRYPTION_MASTER_KEYS or not self.is_production)
        return False

    @property
    def r2_configured(self) -> bool:
        """True only when real R2 credentials + endpoint are present.

        Falls back to local disk storage otherwise so uploads work with zero
        external setup in development.
        """
        return bool(
            self.R2_ACCESS_KEY_ID
            and self.R2_SECRET_ACCESS_KEY
            and self.R2_ENDPOINT
            and "xxx" not in self.R2_ENDPOINT
        )

    @property
    def whatsapp_configured(self) -> bool:
        """True only when Twilio can actually send. The channel short-circuits
        on this rather than firing a request that is certain to 401, so an
        unconfigured deployment logs one clear reason instead of noise."""
        return bool(
            self.TWILIO_ACCOUNT_SID
            and self.TWILIO_AUTH_TOKEN
            and self.TWILIO_WHATSAPP_FROM
        )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def show_docs(self) -> bool:
        return not self.is_production

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
