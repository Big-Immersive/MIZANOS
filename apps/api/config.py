"""Application configuration using Pydantic Settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database_url: str = "postgresql+asyncpg://mizan:mizan@localhost:5433/mizanos"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Environment
    environment: str = "development"

    # JWT
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440
    jwt_refresh_token_expire_days: int = 7

    # CORS
    cors_origins: list[str] = ["http://localhost:3006", "http://localhost:3001"]

    # External APIs
    openai_api_key: str = ""
    openrouter_api_key: str = ""
    anthropic_api_key: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    github_webhook_secret: str = ""
    github_api_token: str = ""
    firecrawl_api_key: str = ""

    # Storage (S3-compatible — Railway Bucket / MinIO / AWS)
    aws_s3_bucket_name: str = ""
    aws_default_region: str = "auto"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_endpoint_url: str = ""

    # Storage (GCS)
    gcs_bucket_name: str = ""
    gcs_project_id: str = ""
    gcs_credentials_path: str = ""
    gcs_credentials_json: str = ""

    # Email (Resend)
    resend_api_key: str = ""
    email_from: str = "Mizan <onboarding@resend.dev>"
    app_base_url: str = "http://localhost:3006"
    api_base_url: str = "http://localhost:8000"

    # Google OAuth
    google_oauth_client_id: str = ""

    # Encryption
    credential_encryption_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
