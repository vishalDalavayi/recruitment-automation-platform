from pathlib import Path
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


LLMProviderName = Literal["openai", "grok", "groq", "ollama"]
FallbackLLMProviderName = Literal["", "openai", "grok", "groq", "ollama"]


class Settings(BaseSettings):
    app_name: str = Field(default="Resume Formatter API", validation_alias="APP_NAME")
    app_env: str = Field(default="development", validation_alias="APP_ENV")

    llm_provider: LLMProviderName = Field(
        default="openai",
        validation_alias="LLM_PROVIDER",
    )
    llm_model: str = Field(default="", validation_alias="LLM_MODEL")
    fallback_llm_provider: FallbackLLMProviderName = Field(
        default="",
        validation_alias="FALLBACK_LLM_PROVIDER",
    )
    fallback_llm_model: str = Field(default="", validation_alias="FALLBACK_LLM_MODEL")

    openai_api_key: str = Field(default="", validation_alias="OPENAI_API_KEY")
    grok_api_key: str = Field(default="", validation_alias="GROK_API_KEY")
    grok_base_url: str = Field(
        default="https://api.x.ai/v1",
        validation_alias="GROK_BASE_URL",
    )
    groq_api_key: str = Field(default="", validation_alias="GROQ_API_KEY")
    groq_base_url: str = Field(
        default="https://api.groq.com/openai/v1",
        validation_alias="GROQ_BASE_URL",
    )
    ollama_base_url: str = Field(
        default="http://localhost:11434",
        validation_alias="OLLAMA_BASE_URL",
    )
    ollama_timeout_seconds: float = Field(
        default=300.0,
        validation_alias="OLLAMA_TIMEOUT_SECONDS",
    )

    generated_resume_dir: Path = Field(
        default=Path("generated_resumes"),
        validation_alias="GENERATED_RESUME_DIR",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def resolved_llm_model(self) -> str:
        return self.resolve_llm_model(self.llm_provider, self.llm_model)

    @property
    def resolved_fallback_llm_model(self) -> str:
        if not self.fallback_llm_provider:
            return ""
        return self.resolve_llm_model(self.fallback_llm_provider, self.fallback_llm_model)

    def resolve_llm_model(self, provider_name: LLMProviderName, configured_model: str = "") -> str:
        if configured_model:
            return configured_model

        defaults = {
            "openai": "gpt-4.1-mini",
            "grok": "grok-3-mini",
            "groq": "llama-3.1-8b-instant",
            "ollama": "llama3.2",
        }
        return defaults[provider_name]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
