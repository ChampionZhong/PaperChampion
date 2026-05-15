"""Application settings backed by Pydantic Settings."""

import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _resolve_env_file() -> str:
    """Return the configured environment file path."""
    return os.environ.get("PAPERCHAMPION_ENV_FILE", ".env")


class Settings(BaseSettings):
    app_env: str = "dev"
    app_name: str = "PaperChampion API"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Site configuration.
    site_url: str = "http://localhost:5174"

    # Authentication is disabled when auth_password is empty.
    auth_password: str = ""
    auth_secret_key: str = "change-me-use-a-strong-random-value"

    database_url: str = "sqlite:///./data/paperchampion.db"
    pdf_storage_root: Path = Path("./data/papers")
    brief_output_root: Path = Path("./data/briefs")
    skim_score_threshold: float = 0.65
    daily_cron: str = "0 21 * * *"
    weekly_cron: str = "0 22 * * 0"
    cors_allow_origins: str = (
        "http://localhost:5174,http://127.0.0.1:5174,"
        "http://localhost:3003,http://127.0.0.1:3003"
    )

    # LLM Provider: openai / anthropic / zhipu
    llm_provider: str = "zhipu"
    llm_model_skim: str = "glm-4.7"
    llm_model_deep: str = "glm-4.7"
    llm_model_vision: str = "glm-4.6v"
    llm_model_fallback: str = "glm-4.7"
    embedding_model: str = "embedding-3"

    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    zhipu_api_key: str | None = None
    semantic_scholar_api_key: str | None = None
    openalex_email: str | None = None

    # Worker scheduling.
    worker_retry_max: int = 2
    worker_retry_base_delay: float = 5.0

    # ArXiv request interval in seconds.
    arxiv_request_delay_sec: float = 5.0

    # Concurrency and cache settings.
    paper_concurrency: int = 5
    brief_cache_ttl: int = 300

    cost_guard_enabled: bool = True
    per_call_budget_usd: float = 0.05
    daily_budget_usd: float = 2.0

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    notify_default_to: str | None = None
    # User timezone for user-facing date boundaries and daily grouping.
    user_timezone: str = "Asia/Shanghai"

    model_config = SettingsConfigDict(
        env_file=_resolve_env_file(),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.pdf_storage_root.mkdir(parents=True, exist_ok=True)
    settings.brief_output_root.mkdir(parents=True, exist_ok=True)
    db_parent = Path(settings.database_url.replace("sqlite:///", "")).parent
    db_parent.mkdir(parents=True, exist_ok=True)
    return settings
