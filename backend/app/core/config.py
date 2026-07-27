from typing import Annotated

from pydantic import ValidationInfo, field_validator
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

    # ── Firebase FCM ─────────────────────────────────────────
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "./firebase-service-account.json"

    # ── Sentry ───────────────────────────────────────────────
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    SENTRY_PROFILES_SAMPLE_RATE: float = 0.1

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

    @field_validator("CORS_ORIGINS", "ALLOWED_MIME_TYPES", mode="before")
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

    # ── Computed properties ──────────────────────────────────
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
