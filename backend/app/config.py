import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # local dev only; real environment variables take precedence

LOG_LEVELS = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Missing required environment variable {name}. "
            "Copy .env.example to .env (see docs/setup.md)."
        )
    return value


def _optional(name: str, default):
    # Env vars are always strings; cast to the default's type.
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return type(default)(raw)
    except ValueError:
        raise RuntimeError(f"{name} must be a number, got {raw!r}") from None


def _csv(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    redis_url: str
    data_dir: Path
    weights_dir: Path
    cors_origins: tuple[str, ...]
    max_file_size_mb: int
    allowed_extensions: frozenset[str]
    default_model: str
    default_confidence: float
    log_level: str

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def results_dir(self) -> Path:
        return self.data_dir / "results"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "jobs.db"


def load_settings() -> Settings:
    settings = Settings(
        redis_url=_required("REDIS_URL"),
        data_dir=Path(_required("DATA_DIR")).resolve(),
        weights_dir=Path(_required("WEIGHTS_DIR")).resolve(),
        cors_origins=tuple(_csv(_required("CORS_ORIGINS"))),
        max_file_size_mb=_optional("MAX_FILE_SIZE_MB", 500),
        allowed_extensions=frozenset(
            ext.lower().lstrip(".")
            for ext in _csv(_optional("ALLOWED_EXTENSIONS", "mp4,avi,mov,jpg,jpeg,png"))
        ),
        default_model=_optional("DEFAULT_MODEL", "yolov8n"),
        default_confidence=_optional("DEFAULT_CONFIDENCE", 0.45),
        log_level=_optional("LOG_LEVEL", "INFO").upper(),
    )
    if settings.max_file_size_mb <= 0:
        raise RuntimeError("MAX_FILE_SIZE_MB must be greater than 0")
    if not settings.allowed_extensions:
        raise RuntimeError("ALLOWED_EXTENSIONS must list at least one file type")
    if not 0 < settings.default_confidence <= 1:
        raise RuntimeError("DEFAULT_CONFIDENCE must be between 0 and 1")
    if settings.log_level not in LOG_LEVELS:
        raise RuntimeError(f"LOG_LEVEL must be one of {sorted(LOG_LEVELS)}")
    return settings


settings = load_settings()
