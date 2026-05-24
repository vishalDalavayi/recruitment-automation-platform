import os
import subprocess
import threading
import time
from datetime import datetime

from services.common import logger


_REPO_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
_MATCHING_SCRIPT_PATH = os.path.join(_REPO_ROOT, "scripts", "run-daily-match-batch.js")
_NODE_BIN = os.getenv("NODE_BIN", "node")
_MATCHING_SCHEDULE_ENABLED = str(os.getenv("MATCHING_SCHEDULE_ENABLED", "true")).strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
_MATCHING_SCHEDULE_TIME = str(os.getenv("MATCHING_SCHEDULE_TIME", "01:30 PM")).strip() or "01:30 PM"
_MATCHING_BATCH_TIMEOUT_SECONDS = max(
    60,
    int(os.getenv("MATCHING_BATCH_TIMEOUT_SECONDS", "14400")),
)

_state_lock = threading.Lock()
_scheduler_thread = None
_state = {
    "running": False,
    "last_scheduled_run_date": None,
    "last_started_at": None,
    "last_completed_at": None,
    "last_exit_code": None,
    "last_error": None,
    "last_triggered_by": None,
}


def _parse_schedule_time(value: str) -> datetime:
    source = str(value or "").strip()
    for fmt in ("%I:%M %p", "%H:%M"):
        try:
            return datetime.strptime(source, fmt)
        except ValueError:
            continue
    raise ValueError(
        f"Invalid MATCHING_SCHEDULE_TIME '{source}'. Expected HH:MM or HH:MM AM/PM."
    )


def _log_process_output(prefix: str, text: str) -> None:
    message = str(text or "").strip()
    if not message:
        return
    for line in message.splitlines():
        logger.info("%s %s", prefix, line)


def trigger_daily_matching(triggered_by: str = "manual") -> bool:
    with _state_lock:
        if _state["running"]:
            logger.info("MATCHING_AUTOMATION: Daily matching already running, skipping duplicate trigger.")
            return False

        _state["running"] = True
        _state["last_triggered_by"] = triggered_by
        _state["last_started_at"] = datetime.now().isoformat()
        _state["last_error"] = None

    def _worker():
        exit_code = None
        error_text = None
        try:
            logger.info(
                "MATCHING_AUTOMATION: Starting daily matching batch via %s %s",
                _NODE_BIN,
                _MATCHING_SCRIPT_PATH,
            )
            result = subprocess.run(
                [_NODE_BIN, _MATCHING_SCRIPT_PATH],
                cwd=_REPO_ROOT,
                env=os.environ.copy(),
                capture_output=True,
                text=True,
                timeout=_MATCHING_BATCH_TIMEOUT_SECONDS,
                check=False,
            )
            exit_code = result.returncode
            _log_process_output("MATCHING_BATCH:", result.stdout)
            if result.stderr:
                for line in str(result.stderr).strip().splitlines():
                    logger.warning("MATCHING_BATCH STDERR: %s", line)
            if result.returncode != 0:
                error_text = f"Daily matching batch exited with code {result.returncode}."
                logger.error("MATCHING_AUTOMATION: %s", error_text)
            else:
                logger.info("MATCHING_AUTOMATION: Daily matching batch completed successfully.")
        except subprocess.TimeoutExpired as exc:
            exit_code = -1
            error_text = (
                f"Daily matching batch timed out after {_MATCHING_BATCH_TIMEOUT_SECONDS} seconds."
            )
            _log_process_output("MATCHING_BATCH:", exc.stdout or "")
            if exc.stderr:
                for line in str(exc.stderr).strip().splitlines():
                    logger.warning("MATCHING_BATCH STDERR: %s", line)
            logger.error("MATCHING_AUTOMATION: %s", error_text)
        except FileNotFoundError:
            exit_code = -1
            error_text = (
                f"Unable to start daily matching batch because '{_NODE_BIN}' is not installed or not on PATH."
            )
            logger.error("MATCHING_AUTOMATION: %s", error_text)
        except Exception as exc:
            exit_code = -1
            error_text = str(exc)
            logger.error("MATCHING_AUTOMATION: Daily matching batch failed: %s", exc)
        finally:
            with _state_lock:
                _state["running"] = False
                _state["last_completed_at"] = datetime.now().isoformat()
                _state["last_exit_code"] = exit_code
                _state["last_error"] = error_text

    threading.Thread(target=_worker, daemon=True, name="daily-matching-batch").start()
    return True


def start_matching_scheduler() -> None:
    global _scheduler_thread

    with _state_lock:
        if _scheduler_thread and _scheduler_thread.is_alive():
            return

    def _scheduler_worker():
        logger.info(
            "MATCHING_AUTOMATION: Starting matching scheduler (enabled=%s, time=%s).",
            _MATCHING_SCHEDULE_ENABLED,
            _MATCHING_SCHEDULE_TIME,
        )
        while True:
            try:
                if not _MATCHING_SCHEDULE_ENABLED:
                    time.sleep(10)
                    continue

                now = datetime.now()
                today = now.strftime("%Y-%m-%d")
                target_dt = _parse_schedule_time(_MATCHING_SCHEDULE_TIME).replace(
                    year=now.year,
                    month=now.month,
                    day=now.day,
                )

                should_trigger = False
                with _state_lock:
                    if (
                        _state["last_scheduled_run_date"] != today
                        and now >= target_dt
                        and not _state["running"]
                    ):
                        _state["last_scheduled_run_date"] = today
                        should_trigger = True

                if should_trigger:
                    logger.info(
                        "MATCHING_AUTOMATION: Triggering scheduled daily matching for %s at %s.",
                        today,
                        _MATCHING_SCHEDULE_TIME,
                    )
                    trigger_daily_matching(triggered_by="scheduled")
            except Exception as exc:
                logger.error("MATCHING_AUTOMATION: Scheduler loop error: %s", exc)

            time.sleep(10)

    _scheduler_thread = threading.Thread(
        target=_scheduler_worker,
        daemon=True,
        name="matching-scheduler",
    )
    _scheduler_thread.start()
