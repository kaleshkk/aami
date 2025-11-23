from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Aami API"
    environment: str = "development"
    secret_key: str = "changeme"  # override in production
    database_url: str = "postgresql://vault:changeme@db:5432/vaultdb"
    access_token_expire_minutes: int = 30

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


