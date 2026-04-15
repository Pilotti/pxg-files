from pydantic import model_validator
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET_KEY: str
    JWT_REFRESH_SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_MINUTES: int

    ADMIN_USERNAME: str
    ADMIN_PASSWORD: str
    ADMIN_SECRET_KEY: str
    ADMIN_TOKEN_TTL_SECONDS: int = 43200
    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:8000,http://127.0.0.1:8000,http://localhost,http://127.0.0.1"
    OCR_MAX_FILES: int = 10
    OCR_MAX_FILE_SIZE_MB: int = 8
    OCR_IMAGE_TIMEOUT_SECONDS: int = 15
    OCR_TESSERACT_LANG: str = "eng"
    OCR_TESSERACT_OEM: int = 1
    OCR_REVIEW_DIR: str = "backend/app/data/ocr_review"
    CATALOG_STORAGE: str = "json"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    @property
    def _repo_root(self) -> Path:
        return Path(__file__).resolve().parents[3]

    @model_validator(mode="after")
    def reject_unsafe_admin_defaults(self):
        unsafe_values = {
            "ADMIN_PASSWORD": {"admin", "admin123", "password", "change-me"},
            "ADMIN_SECRET_KEY": {"change-this-admin-secret", "change-me", "secret"},
        }

        if not str(self.ADMIN_USERNAME or "").strip():
            raise ValueError("ADMIN_USERNAME deve ser configurado.")

        if str(self.CORS_ALLOWED_ORIGINS or "").strip() == "*":
            raise ValueError("CORS_ALLOWED_ORIGINS nao pode ser '*' com credenciais habilitadas.")

        for field_name, blocked_values in unsafe_values.items():
            value = str(getattr(self, field_name, "") or "").strip()
            if not value:
                raise ValueError(f"{field_name} deve ser configurado.")
            if value.lower() in blocked_values:
                raise ValueError(f"{field_name} usa valor inseguro de exemplo.")

        return self

    @property
    def database_url(self) -> str:
        return self.DATABASE_URL

    @property
    def jwt_secret_key(self) -> str:
        return self.JWT_SECRET_KEY

    @property
    def jwt_refresh_secret_key(self) -> str:
        return self.JWT_REFRESH_SECRET_KEY

    @property
    def access_token_expire_minutes(self) -> int:
        return self.ACCESS_TOKEN_EXPIRE_MINUTES

    @property
    def refresh_token_expire_minutes(self) -> int:
        return self.REFRESH_TOKEN_EXPIRE_MINUTES

    @property
    def admin_username(self) -> str:
        return self.ADMIN_USERNAME

    @property
    def admin_password(self) -> str:
        return self.ADMIN_PASSWORD

    @property
    def admin_secret_key(self) -> str:
        return self.ADMIN_SECRET_KEY

    @property
    def admin_token_ttl_seconds(self) -> int:
        return self.ADMIN_TOKEN_TTL_SECONDS

    @property
    def cors_allowed_origins(self) -> list[str]:
        raw = str(self.CORS_ALLOWED_ORIGINS or "").strip()
        if not raw:
            return []
        if raw == "*":
            return ["*"]
        return [item.strip() for item in raw.split(",") if item.strip()]

    @property
    def ocr_max_files(self) -> int:
        return max(1, int(self.OCR_MAX_FILES))

    @property
    def ocr_max_file_size_mb(self) -> int:
        return max(1, int(self.OCR_MAX_FILE_SIZE_MB))

    @property
    def ocr_image_timeout_seconds(self) -> int:
        return max(1, int(self.OCR_IMAGE_TIMEOUT_SECONDS))

    @property
    def ocr_tesseract_lang(self) -> str:
        return str(self.OCR_TESSERACT_LANG or "eng").strip() or "eng"

    @property
    def ocr_tesseract_oem(self) -> int:
        value = int(self.OCR_TESSERACT_OEM)
        if value < 0 or value > 3:
            return 1
        return value

    @property
    def ocr_review_dir(self) -> str:
        raw_value = str(self.OCR_REVIEW_DIR or "backend/app/data/ocr_review").strip() or "backend/app/data/ocr_review"
        review_dir = Path(raw_value)
        if not review_dir.is_absolute():
            review_dir = (self._repo_root / review_dir).resolve()
        return str(review_dir)

    @property
    def catalog_storage(self) -> str:
        value = str(self.CATALOG_STORAGE or "json").strip().lower()
        if value not in {"json", "database"}:
            raise ValueError("CATALOG_STORAGE deve ser 'json' ou 'database'.")
        return value

    @property
    def use_database_catalog(self) -> bool:
        return self.catalog_storage == "database"


settings = Settings()
