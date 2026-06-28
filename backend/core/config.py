from pathlib import Path
from typing import Literal

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # env_file is anchored to the backend package directory (backend/.env),
    # NOT the process CWD. uvicorn runs from the project root, where a bare
    # ".env" would silently resolve to a non-existent file — that exact bug
    # left GEMINI_API_KEY empty in Phase 1B.
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[1] / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ────────────────────────────────────────────────
    APP_ENV: Literal["development", "production", "test"] = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    DEBUG: bool = True

    # ── AI Keys ────────────────────────────────────────────
    ANTHROPIC_API_KEY: str = Field(default="", description="Claude API key")
    GEMINI_API_KEY: str = Field(default="", description="Gemini API key")
    DEFAULT_AI_ADVISOR: Literal["claude", "gemini"] = "claude"

    # ── Data Paths ─────────────────────────────────────────
    DATA_PATH: Path = Path("./data")
    DUCKDB_PATH: Path = Path("./data/agroprice.duckdb")

    # ── Cache ──────────────────────────────────────────────
    CACHE_TTL_HOURS: int = 24
    CACHE_DIR: Path = Path("./data/cache")

    # ── AI Advisor Memory ───────────────────────────────────
    ADVISOR_MEMORY_BACKEND: Literal["memory", "redis"] = "memory"
    REDIS_URL: str = "redis://localhost:6379"

    # ── CORS ───────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://localhost:3000"

    # ── Forecasting ────────────────────────────────────────
    DEFAULT_FORECAST_DAYS: int = 90
    MIN_DATA_POINTS: int = 30

    # ── Logging ────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    LOG_FILE: Path = Path("./logs/agroprice.log")

    @computed_field
    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @computed_field
    @property
    def parquet_dir(self) -> Path:
        return self.DATA_PATH / "raw" / "parquet"

    @computed_field
    @property
    def processed_dir(self) -> Path:
        return self.DATA_PATH / "processed"


settings = Settings()
