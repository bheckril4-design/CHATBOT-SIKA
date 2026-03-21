from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_name: str = "SIKA API"
    app_version: str = "0.1.0"
    environment: str = "development"
    demo_mode: bool = True
    allowed_origins: str = (
        "https://sika.oceanicconseils.com,http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000"
    )
    trusted_hosts: str = (
        "sika-api.oceanicconseils.com,sika.oceanicconseils.com,www.sika.oceanicconseils.com,localhost,127.0.0.1,testserver"
    )
    openai_api_key: str | None = None
    openai_model: str = "gpt-5.2"
    openai_reasoning_effort: str = "none"
    openai_text_verbosity: str = "medium"
    openai_temperature: float | None = 0.2
    max_history_messages: int = 16
    rate_limit_per_minute: int = 30
    market_data_provider: str = "demo"
    twelve_data_api_key: str | None = None
    alpha_vantage_api_key: str | None = None
    exchange_rate_api_key: str | None = None

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.allowed_origins.split(",")
            if origin.strip()
        ]

    @property
    def trusted_host_list(self) -> list[str]:
        return [
            host.strip()
            for host in self.trusted_hosts.split(",")
            if host.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
