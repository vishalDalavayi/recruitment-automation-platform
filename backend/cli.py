"""
KonfigAI Job Digger — CLI Entry Point
=======================================

Production usage (separate terminals):
  python cli.py --service api          # Terminal 1 — Port 8000
  python cli.py --service scheduler    # Terminal 2 — Port 8002
  python cli.py --service worker       # Terminal 3 — Port 8001

Development usage (single process, NOT recommended for production):
  python cli.py --service all          # All-in-one on Port 8000

Utilities:
  python cli.py --service migrate      # Run DB schema sync + indexes
"""

import sys
import os
import socket
import signal
import argparse

# Ensure backend directory is in path
_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)


def is_port_in_use(port: int) -> bool:
    """Check if a port is already bound by another process."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


def ensure_port_free(port: int):
    """Automatically release the port if occupied (Windows only)."""
    import socket
    import subprocess
    import re
    import time
    
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("127.0.0.1", port)) != 0:
            return

    print(f"[*] Port {port} is occupied. Releasing...")
    try:
        # Find PIDs using the port
        output = subprocess.check_output(f"netstat -ano | findstr LISTENING | findstr :{port}", shell=True).decode()
        pids = set(re.findall(r"\s+(\d+)\s*$", output, re.MULTILINE))
        for pid in pids:
            if pid == "0": continue
            subprocess.run(f"taskkill /PID {pid} /F", shell=True, capture_output=True)
        time.sleep(1) # Wait for OS to free the socket
    except Exception as e:
        print(f"[!] Could not auto-release port {port}: {e}")


def _run_uvicorn(app_target: str, port: int, factory: bool = False):
    """
    Run uvicorn using the standard entry point.
    Standard uvicorn.run handles signals (Ctrl+C) and port binding
    correctly across all platforms.
    """
    import uvicorn

    uvicorn.run(
        app=app_target,
        host="0.0.0.0",
        port=port,
        factory=factory,
        log_level="info",
        reload=False  # Always False for production/all-in-one stability
    )


def run_api():
    """Start the API service only — no scheduler, no scraper."""
    port = int(os.environ.get("PORT", 8000))
    ensure_port_free(port)
    # Set mode env var so app factory knows
    os.environ["APP_MODE"] = "api"
    print(f"[*] Starting API service on port {port}...")
    _run_uvicorn("app.main:create_app", port, factory=True)


def run_all():
    """Start all services (API + Scheduler) with clean separation (dev only)."""
    port = int(os.environ.get("PORT", 8000))
    ensure_port_free(port)

    print("[!] WARNING: --service all runs API + Scheduler.")
    print("    Starting Scheduler in background thread...")

    import threading
    import asyncio
    
    def _background_scheduler():
        """Standalone scheduler loop in a separate thread (deferred start)."""
        import time
        time.sleep(5) # Give API time to bind to port
        
        import asyncio
        from services.scheduler.manager import get_scheduler
        from services.common import scraper_config, load_settings
        from app.config import get_settings
        from services.matching_automation import start_matching_scheduler
        
        settings = get_settings()
        if not settings.database_url:
            print("[ERROR] No DATABASE_URL for scheduler.")
            return

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        mgr = get_scheduler()
        start_matching_scheduler()
        
        async def _run():
            await mgr.start()
            last_scraper_time = None
            last_cleaner_time = None
            last_enabled_state = None
            
            while True:
                load_settings()
                
                s_time = scraper_config.get("schedule_time", "08:30")
                c_time = scraper_config.get("cleaner_schedule_time", "08:00")
                is_enabled = scraper_config.get("schedule_enabled", True)
                
                if is_enabled != last_enabled_state:
                    if is_enabled:
                        print(f"[*] Scheduler: Active (Scraper: {s_time}, Cleaner: {c_time})")
                    else:
                        print("[*] Scheduler: Paused")
                        try:
                            await mgr.pause_job("daily_scraper_pipeline")
                            await mgr.pause_job("daily_cleaner_pipeline")
                        except: pass
                    last_enabled_state = is_enabled

                if is_enabled:
                    # Sync Scraper
                    if s_time != last_scraper_time:
                        try:
                            h, m = map(int, s_time.split(":"))
                            from services.scheduler.jobs import run_scraper_only_pipeline
                            mgr.schedule_cron_job(run_scraper_only_pipeline, hour=h, minute=m, job_id="daily_scraper_pipeline")
                            last_scraper_time = s_time
                            status = await mgr.get_job_status("daily_scraper_pipeline")
                            print(f"[*] Scraper updated to {s_time}. Next run: {status.get('next_run')}")
                        except Exception as e:
                            print(f"[!] Scheduler: Scraper sync failed: {e}")
                    
                    # Sync Cleaner
                    if c_time != last_cleaner_time:
                        try:
                            h, m = map(int, c_time.split(":"))
                            from services.scheduler.jobs import run_cleaner_pipeline
                            mgr.schedule_cron_job(run_cleaner_pipeline, hour=h, minute=m, job_id="daily_cleaner_pipeline")
                            last_cleaner_time = c_time
                            status = await mgr.get_job_status("daily_cleaner_pipeline")
                            print(f"[*] Cleaner updated to {c_time}. Next run: {status.get('next_run')}")
                        except Exception as e:
                            print(f"[!] Scheduler: Cleaner sync failed: {e}")

                await asyncio.sleep(60)

        loop.run_until_complete(_run())

    def _background_resume_worker():
        """Standalone resume formatter worker (deferred start)."""
        import time
        time.sleep(10) # Lower priority than scheduler
        
        from services.resume_formatter import CandidateResumeFormatterService
        from app.models.base import get_session_factory
        from app.models.candidates import Candidate, FormattingResumeInfo
        
        formatter = CandidateResumeFormatterService()
        print("    [*] Resume Formatter Worker online.")
        
        while True:
            Session = get_session_factory()
            db = Session()
            try:
                pending = (
                    db.query(Candidate)
                    .join(FormattingResumeInfo)
                    .filter(FormattingResumeInfo.formatted_resume_status.in_(["processing", "not_started"]))
                    .filter(Candidate.raw_resume_path.isnot(None))
                    .limit(3)
                    .all()
                )
                
                for candidate in pending:
                    try:
                        print(f"[*] Worker: Processing {candidate.first_name} {candidate.last_name}...")
                        formatter.mark_candidate_processing(candidate.unique_id)
                        formatter.process_candidate_resume(candidate.unique_id, candidate.raw_resume_path)
                    except Exception as e:
                        print(f"[!] Worker Error: {e}")
            except Exception as e:
                print(f"[!] Worker DB Error: {e}")
            finally:
                db.close()
            
            time.sleep(30) # Poll less frequently to save resources

    threading.Thread(target=_background_scheduler, daemon=True).start()
    threading.Thread(target=_background_resume_worker, daemon=True).start()

    os.environ["APP_MODE"] = "all"
    print(f"[*] Starting API service on port {port}...")
    _run_uvicorn("app.main:create_app", port, factory=True)


def run_scheduler():
    """Start the scheduler service."""
    port = int(os.environ.get("SCHEDULER_PORT", 8002))
    ensure_port_free(port)
    print(f"[*] Starting scheduler service on port {port}...")
    _run_uvicorn("services.scheduler.service:app", port)


def run_worker():
    """Start the worker (scraper) service."""
    port = int(os.environ.get("SCRAPER_PORT", 8001))
    ensure_port_free(port)
    print(f"[*] Starting worker service on port {port}...")
    _run_uvicorn("services.scraper.main:app", port)


def run_migrate():
    """Run database migrations (schema sync + indexes)."""
    print("[*] Running database migrations...")
    from database import init_db, DBManager
    init_db()
    dm = DBManager()
    try:
        dm.create_indexes()
        print("[OK] Database migrations complete.")
    finally:
        dm.close()


def main():
    parser = argparse.ArgumentParser(
        description="KonfigAI Job Digger — Production Service Manager",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Production (separate terminals):
  python cli.py --service api          Port 8000 — API only (< 3s startup)
  python cli.py --service scheduler    Port 8002 — Cron scheduler
  python cli.py --service worker       Port 8001 — Scraper worker

Development (single process):
  python cli.py --service all          Port 8000 — Everything (not for prod)

Utilities:
  python cli.py --service migrate      One-time DB schema sync
        """,
    )
    parser.add_argument(
        "--service",
        choices=["api", "scheduler", "worker", "all", "migrate"],
        default="all",
        help="Service to run (default: all)",
    )

    args = parser.parse_args()

    runners = {
        "api": run_api,
        "all": run_all,
        "scheduler": run_scheduler,
        "worker": run_worker,
        "migrate": run_migrate,
    }
    runners[args.service]()


if __name__ == "__main__":
    main()
