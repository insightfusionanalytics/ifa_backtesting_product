from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[3] / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_ENV: str = "local"
    APP_NAME: str = "ifa-backtest-product"
    API_PREFIX: str = "/api/v1"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_BUCKET: str = "ifa-private"

    # Postgres
    DATABASE_URL_SYNC: str = Field(..., description="psycopg2 connection string")

    # Firebase
    FIREBASE_PROJECT_ID: str
    FIREBASE_CREDENTIALS_PATH: str

    # Admin bootstrap
    MAIN_ADMIN_EMAIL: str
    MAIN_ADMIN_INITIAL_PASSWORD: str

    # CORS — comma-separated origins. Includes localhost fallback for dev.
    # In prod set this to your Vercel domain(s), e.g.
    #   ALLOWED_ORIGINS=https://app.example.com,https://app-staging.example.com
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Observability
    SENTRY_DSN_BACKEND: str = ""

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
