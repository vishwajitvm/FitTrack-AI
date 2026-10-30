"""Application settings, loaded from backend/.env (or real environment variables).

Real environment variables always win over the .env file, which is how Docker Compose
overrides hostnames (e.g. `db` instead of `localhost`) without touching the file.
"""
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"

# Load .env into os.environ (without overriding real env vars) so provider keys such as
# GROQ_API_KEY can be discovered generically by the LLM catalog.
load_dotenv(ENV_FILE, override=False)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    app_name: str = "FitTrack AI"
    app_env: str = "development"
    app_version: str = "1.0.0"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    secret_key: str = "change-me-to-a-long-random-string"
    log_level: str = "INFO"

    # --- Database / cache ---
    database_url: str = "postgresql+asyncpg://fittrack:fittrack@localhost:5432/fittrack"
    # Docker Compose sets this to "db" so DATABASE_URL (and its password) stays defined only in .env
    database_host: str = ""
    db_echo: bool = False
    redis_url: str = ""

    # --- Files ---
    upload_dir: Path = BACKEND_DIR / "data" / "uploads"
    export_dir: Path = BACKEND_DIR / "data" / "exports"
    max_upload_mb: int = 15
    auto_sync_files: bool = True

    # --- Seed ---
    seed_baseline: bool = True

    # --- On-device machine learning (see docs/ML.md) ---
    ml_enabled: bool = True
    ml_preload: bool = True  # download/load models in the background at startup
    ml_text_model: str = "nomic-ai/nomic-embed-text-v1.5-Q"
    ml_vision_model: str = "nomic-ai/nomic-embed-vision-v1.5-Q"
    model_dir: Path = BACKEND_DIR / "data" / "models"

    # --- AI ---
    ollama_base_url: str = "http://localhost:11434"
    llm_timeout_seconds: int = 60
    llm_max_attempts: int = 12
    llm_rate_limit_cooldown_seconds: int = 60

    # --- Nutrition / search integrations (can also be managed from the UI) ---
    usda_api_key: str = "DEMO_KEY"
    tavily_api_key: str = ""
    serper_api_key: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.database_host and not s.is_sqlite:
        url = make_url(s.database_url).set(host=s.database_host, port=5432)
        s.database_url = url.render_as_string(hide_password=False)
    for name in ("upload_dir", "export_dir", "model_dir"):
        path = Path(getattr(s, name))
        if not path.is_absolute():
            path = BACKEND_DIR / path
        path.mkdir(parents=True, exist_ok=True)
        setattr(s, name, path)
    return s


settings = get_settings()
