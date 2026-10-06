"""
KrishiMitra — Application Configuration

Reads environment variables with pydantic-settings.
All settings are centralized here.
"""

import os
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    # ---- Application ----
    app_name: str = "KrishiMitra"
    debug: bool = False
    upload_dir: str = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "data", "uploads")
    )

    # ---- Database ----
    database_url: str = Field(
        default="postgresql://agriuser:agripass@postgres:5432/agridb",
        description="PostgreSQL connection string (asyncpg format, no driver prefix)",
    )

    # ---- Redis ----
    redis_url: str = "redis://redis:6379/0"

    # ---- MinIO ----
    minio_root_user: str = "minioadmin"
    minio_root_password: str = "minioadmin"
    minio_endpoint: str = "minio:9000"

    # ---- JWT ----
    jwt_secret_key: str = "change_me_in_production_minimum_32_characters_long"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7

    # ---- Google OAuth ----
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"

    # ---- URLs ----
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"

    # ---- External APIs ----
    openweather_api_key: str = ""
    gemini_api_key: str = ""
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_max_tokens: int = 1024
    groq_temperature: float = 0.7
    google_translate_api_key: str = ""
    google_translate_endpoint: str = "https://translation.googleapis.com/language/translate/v2"
    opencage_api_key: str = ""
    data_gov_in_api_key: str = ""
    data_gov_in_endpoint: str = ""

    # ---- Confidence & Safety Thresholds ----
    disease_min_confidence: float = 0.60
    pest_min_confidence: float = 0.55

    # ---- Kaggle ----
    kaggle_username: str = ""
    kaggle_key: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


# Singleton — import this everywhere
settings = Settings()
