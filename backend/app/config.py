"""
Centralized Configuration — Pydantic Settings
===============================================
Single source of truth for all environment variables.
Validates on startup, fails fast on misconfiguration.
"""

import re
import urllib.parse
import logging
from pathlib import Path
from typing import Optional, List
from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import field_validator, Field


_ENV_FILES = (
    Path(__file__).resolve().parents[2] / ".env",
    Path(__file__).resolve().parents[1] / ".env",
)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- Database ---
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = ""
    db_user: str = ""
    db_pass: str = ""
    database_url_env: Optional[str] = Field(default=None, validation_alias="DATABASE_URL")
    db_schema: str = "scrapped_data"
    candidate_schema: str = "candidate_details"

    # --- Redis ---
    redis_url: Optional[str] = None

    # --- API ---
    scraper_api_key: Optional[str] = None

    # --- Scraper Parameters ---
    scrape_cooldown: int = 300
    max_search_pages: int = 100
    request_timeout: int = 30
    max_workers: int = 3
    batch_size: int = 50
    max_retries: int = 3
    pipeline_timeout: int = 3600

    # --- Checker Parameters ---
    check_batch_size: int = 100
    max_concurrent_checks: int = 10
    max_missing_count: int = 3
    check_retries: int = 2

    # --- Azure Storage ---
    azure_storage_connection_string: Optional[str] = None
    azure_container_name: str = "konfigai-az-analytics-storage"
    azure_raw_resume_path: str = "Resume-intelligence/candidate-raw-resumes/"
    azure_formatted_resume_path: str = "Resume-intelligence/candidate-formatted-resumes/"
    azure_confidential_documents_path: str = "candidate_confidential_documents/"
    azure_client_id: Optional[str] = None
    azure_client_secret: Optional[str] = None
    azure_tenant_id: Optional[str] = None
    azure_storage_account_name: str = "konfigai"

    # --- LLM ---
    llm_provider: str = "groq"
    llm_model: str = "llama-3.3-70b-versatile"
    fallback_llm_provider: Optional[str] = None
    fallback_llm_model: Optional[str] = None
    openai_api_key: Optional[str] = None
    grok_api_key: Optional[str] = None
    grok_base_url: str = "https://api.x.ai/v1"
    groq_api_key: Optional[str] = None
    groq_base_url: str = "https://api.groq.com/openai/v1"
    ollama_base_url: str = "http://localhost:11434"
    ollama_timeout_seconds: int = 300

    @property
    def database_url(self) -> Optional[str]:
        if self.database_url_env and str(self.database_url_env).strip():
            return str(self.database_url_env).strip()
        if all([self.db_user, self.db_pass, self.db_host, self.db_name]):
            encoded_pass = urllib.parse.quote_plus(self.db_pass)
            return f"postgresql://{self.db_user}:{encoded_pass}@{self.db_host}:{self.db_port}/{self.db_name}"
        return None

    model_config = {
        "env_file": _ENV_FILES,
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


# --- Singleton access ---
@lru_cache()
def get_settings() -> Settings:
    return Settings()


# --- Logging ---
def setup_logging(name: str = "KonfigAI") -> logging.Logger:
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] %(levelname)s [%(name)s]: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    _logger = logging.getLogger(name)
    logging.getLogger("azure").setLevel(logging.WARNING)
    logging.getLogger("azure.core.pipeline.policies.http_logging_policy").setLevel(logging.WARNING)
    return _logger


logger = setup_logging()


# --- Constants ---
HEADERS = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "en-IN,en;q=0.9,te-IN;q=0.8,te;q=0.7,en-GB;q=0.6,en-US;q=0.5",
    "cache-control": "max-age=0",
    "priority": "u=0, i",
    "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
}

OUTPUT_COLUMNS = [
    "title", "company", "location", "salary", "posted_date",
    "job_type", "workplace_type", "description", "skills",
    "experience_required", "url", "keyword", "scraped_at",
]

JD_RE = re.compile(
    r"https://www\.dice\.com/job-detail/"
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.I,
)
JD_REL_RE = re.compile(
    r"/job-detail/"
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.I,
)
