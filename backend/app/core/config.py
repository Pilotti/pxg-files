from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET_KEY: str
    JWT_REFRESH_SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_MINUTES: int

    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"
    ADMIN_SECRET_KEY: str = "change-this-admin-secret"
    ADMIN_TOKEN_TTL_SECONDS: int = 43200

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

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


settings = Settings()