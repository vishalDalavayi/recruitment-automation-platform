import threading
import time
from datetime import datetime

# Import core config from the central config file
import sys
import os

# Add backend to path for internal imports
_backend = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from config import (
    logger, 
    API_KEY, 
    HEADERS, 
    MAX_WORKERS, 
    MAX_RETRIES, 
    REQUEST_TIMEOUT, 
    PIPELINE_TIMEOUT, 
    MAX_SEARCH_PAGES, 
    BATCH_SIZE, 
    OUTPUT_COLUMNS, 
    JD_RE, 
    JD_REL_RE,
    SCRAPE_COOLDOWN,
    AZURE_STORAGE_CONNECTION_STRING,
    AZURE_CONTAINER_NAME,
    AZURE_RAW_RESUME_PATH,
    AZURE_FORMATTED_RESUME_PATH,
    AZURE_CONFIDENTIAL_DOCUMENTS_PATH,
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET,
    AZURE_TENANT_ID,
    AZURE_STORAGE_ACCOUNT_NAME,
    CANDIDATE_SCHEMA,
    DATABASE_URL,
    REDIS_URL,
)

DATE_RANGE_MAP = {
    "24h": "Today",
    "3d": "Last 3 Days",
    "7d": "Last 7 Days",
    "14d": "Last 14 Days",
    "1": "Today",
    "3": "Last 3 Days",
    "7": "Last 7 Days",
    "14": "Last 14 Days",
    "ONE": "Today",
    "THREE": "Last 3 Days",
    "SEVEN": "Last 7 Days",
    "FOURTEEN": "Last 14 Days"
}

DICE_DATE_MAP = {
    "24h": "ONE",
    "3d": "THREE",
    "7d": "SEVEN",
    "14d": "SEVEN",
    "1": "ONE",
    "3": "THREE",
    "7": "SEVEN",
    "14": "SEVEN",
    "ONE": "ONE",
    "THREE": "THREE",
    "SEVEN": "SEVEN"
}

import json

SETTINGS_FILE = os.path.join(_backend, "persistent_settings.json")

scraper_config = {
    "date_range": "24h",
    "date_range_label": "Today",
    "max_search_pages": MAX_SEARCH_PAGES,
    "max_workers": MAX_WORKERS,
    "request_timeout": REQUEST_TIMEOUT,
    "scrape_cooldown": SCRAPE_COOLDOWN,
    "schedule_enabled": True,
    "schedule_time": "08:30",
    "cleaner_schedule_time": "08:00"
}

def save_settings():
    """Save current scraper_config to disk."""
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump(scraper_config, f, indent=4)
        logger.info(f"💾 Settings saved to {SETTINGS_FILE}")
    except Exception as e:
        logger.error(f"❌ Failed to save settings: {e}")

def load_settings():
    """Load settings from disk into scraper_config."""
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                saved = json.load(f)
                scraper_config.update(saved)
            logger.info("📂 Scraper settings loaded from persistent storage.")
        except Exception as e:
            logger.error(f"❌ Failed to load settings: {e}")

# Delay initial load to avoid disk I/O during heavy import phase
# It will be called explicitly by services that need it

class AppState:
    def __init__(self):
        self.status = "idle"
        self.task = "Idle"
        self.progress = 0
        self.error = None
        self.stop_requested = False
        self.last_run_at = None
        self.last_active_count = 0
        self.last_inactive_count = 0
        self.last_run_duration = 0
        self.lock = threading.Lock()

    def update(self, **kwargs):
        with self.lock:
            for k, v in kwargs.items():
                setattr(self, k, v)

    def to_dict(self):
        with self.lock:
            return {
                "status": self.status,
                "task": self.task,
                "progress": self.progress,
                "error": self.error,
                "stop_requested": self.stop_requested,
                "last_run_at": self.last_run_at,
                "last_active_count": self.last_active_count,
                "last_inactive_count": self.last_inactive_count,
                "last_run_duration": self.last_run_duration
            }

app_state = AppState()

def parse_schedule_time(target_time: str, now: datetime = None):
    """
    Centralized time parsing logic for the scheduler.
    Returns a datetime object for today with the specified time.
    """
    if now is None:
        now = datetime.now()
    
    t_clean = str(target_time).upper().strip().replace("AM", " AM").replace("PM", " PM").replace("  ", " ")
    try:
        if "AM" in t_clean or "PM" in t_clean:
            target_dt = datetime.strptime(t_clean, "%I:%M %p")
        else:
            target_dt = datetime.strptime(t_clean, "%H:%M")
        
        # Replace year, month, day with today's values
        return target_dt.replace(year=now.year, month=now.month, day=now.day, second=0, microsecond=0)
    except Exception:
        # Fallback to default if parsing fails (8:30 AM)
        return now.replace(hour=8, minute=30, second=0, microsecond=0)

def should_trigger_scheduler(last_run_date: str, target_time: str, now: datetime = None):
    """
    Check if the scheduler should trigger a run.
    """
    if now is None:
        now = datetime.now()
    
    today = now.strftime("%Y-%m-%d")
    if last_run_date == today:
        return False
        
    target_dt = parse_schedule_time(target_time, now)
    
    # Trigger if we are within 1 hour of the target time
    # (Prevents accidental runs if the system starts up many hours late)
    from datetime import timedelta
    return now >= target_dt and now <= (target_dt + timedelta(minutes=60))
