from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def _default_tariffs_dir() -> Path:
    return _repo_root() / "packages" / "tariffs"


class Settings(BaseSettings):
    app_name: str = "GridMind AI API"
    environment: str = "development"
    tariffs_dir: Path = _default_tariffs_dir()

    # Swappable AI keys (can be supplied via standard or GRIDMIND_-prefixed env vars)
    ai_provider: str = Field(default="auto", validation_alias="GRIDMIND_AI_PROVIDER")
    gemini_api_key: str | None = Field(default=None, validation_alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.0-flash", validation_alias="GEMINI_MODEL")
    openrouter_api_key: str | None = Field(default=None, validation_alias="OPENROUTER_API_KEY")
    openrouter_model: str = Field(
        default="google/gemini-2.0-flash-001", validation_alias="OPENROUTER_MODEL"
    )
    groq_api_key: str | None = Field(default=None, validation_alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama-3.3-70b-versatile", validation_alias="GROQ_MODEL")
    anthropic_api_key: str | None = Field(default=None, validation_alias="ANTHROPIC_API_KEY")
    anthropic_model: str = "claude-sonnet-4-5-20250929"

    database_url: str | None = None
    supabase_url: str | None = None
    supabase_service_key: str | None = None
    redis_url: str | None = None
    s3_endpoint: str | None = None
    s3_bucket: str = "gridmind-bills"
    demo_mode: bool = True
    extraction_timeout_s: int = 40
    agent_timeout_s: int = 10

    model_config = {
        "env_file": [str(_repo_root() / ".env"), ".env"],
        "extra": "ignore",
        "populate_by_name": True,
    }


settings = Settings()
