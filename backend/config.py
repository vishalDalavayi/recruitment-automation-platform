import os
import logging
import re
import urllib.parse
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
_ROOT_ENV = Path(__file__).resolve().parents[1] / ".env"
_BACKEND_ENV = Path(__file__).resolve().parent / ".env"
load_dotenv(_ROOT_ENV)
load_dotenv(_BACKEND_ENV, override=False)

# --- LOGGING ---
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("DiceScraper")
logging.getLogger("azure").setLevel(logging.WARNING)
logging.getLogger("azure.core.pipeline.policies.http_logging_policy").setLevel(
    logging.WARNING
)

# --- CONFIGURATION ---
API_KEY = os.getenv("SCRAPER_API_KEY") 
SCRAPE_COOLDOWN = int(os.getenv("SCRAPE_COOLDOWN", "300"))
REDIS_URL = os.getenv("REDIS_URL", None)

# --- POSTGRES CONFIGURATION ---
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_SCHEMA = os.getenv("DB_SCHEMA", "scrapped_data")
CANDIDATE_SCHEMA = os.getenv("CANDIDATE_SCHEMA", "candidate_details")
DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip() or None

# --- AZURE STORAGE ---
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_CONTAINER_NAME = os.getenv("AZURE_CONTAINER_NAME", "konfigai-az-analytics-storage")
AZURE_RAW_RESUME_PATH = os.getenv("AZURE_RAW_RESUME_PATH", "Resume-intelligence/candidate-raw-resumes/")
AZURE_FORMATTED_RESUME_PATH = os.getenv("AZURE_FORMATTED_RESUME_PATH", "Resume-intelligence/candidate-formatted-resumes/")
AZURE_CONFIDENTIAL_DOCUMENTS_PATH = os.getenv("AZURE_CONFIDENTIAL_DOCUMENTS_PATH", "candidate_confidential_documents/")
AZURE_CLIENT_ID = os.getenv("AZURE_CLIENT_ID")
AZURE_CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET")
AZURE_TENANT_ID = os.getenv("AZURE_TENANT_ID")
AZURE_STORAGE_ACCOUNT_NAME = os.getenv("AZURE_STORAGE_ACCOUNT_NAME", "konfigai")

if not DATABASE_URL:
    if all([DB_USER, DB_PASS, DB_HOST, DB_NAME]):
        DATABASE_URL = f"postgresql://{DB_USER}:{urllib.parse.quote_plus(DB_PASS)}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    else:
        logger.warning("Database credentials not fully provided in environment.")

# --- SCRAPER PARAMETERS ---
MAX_SEARCH_PAGES = 100         # Proper page count for weekly vendor updates
REQUEST_TIMEOUT = 30
MAX_WORKERS = 3            
BATCH_SIZE = 50            
MAX_RETRIES = 3
PIPELINE_TIMEOUT = 3600   

# --- CHECKER PARAMETERS ---
CHECK_BATCH_SIZE = 100
MAX_CONCURRENT_CHECKS = 10
MAX_MISSING_COUNT = 3
CHECK_RETRIES = 2

# Full browser fingerprint — matches legacy scraper headers that bypassed Dice bot detection
HEADERS = {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'en-IN,en;q=0.9,te-IN;q=0.8,te;q=0.7,en-GB;q=0.6,en-US;q=0.5',
    'cache-control': 'max-age=0',
    'priority': 'u=0, i',
    'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
}

OUTPUT_COLUMNS = [
    'title', 'company', 'location', 'salary', 'posted_date', 
    'job_type', 'workplace_type', 'description', 'skills', 'experience_required', 'url', 'keyword', 'scraped_at'
]

# Compiled Regex — strict UUID format to match only real Dice job-detail URLs
JD_RE = re.compile(
    r'https://www\.dice\.com/job-detail/'
    r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
    re.I
)
JD_REL_RE = re.compile(
    r'/job-detail/'
    r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
    re.I
)
