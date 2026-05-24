import asyncio
import httpx
import time
from datetime import datetime, UTC
from urllib.parse import urlparse
from collections import defaultdict
from tqdm import tqdm
from sqlalchemy import text, bindparam
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy import Integer

from database import DBManager, DB_SCHEMA
from config import logger, HEADERS, CHECK_BATCH_SIZE, MAX_CONCURRENT_CHECKS, MAX_MISSING_COUNT, CHECK_RETRIES

class CleanerState:
    def __init__(self):
        self.status = "idle"  # idle, running, finished
        self.total = 0
        self.current = 0
        self.deleted = 0
        self.dead = 0
        self.errors = 0
        self.last_run = None

    def update(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    def to_dict(self):
        return {
            "status": self.status,
            "total": self.total,
            "current": self.current,
            "deleted": self.deleted,
            "dead": self.dead,
            "errors": self.errors,
            "percent": round((self.current / self.total * 100), 1) if self.total > 0 else 0,
            "last_run": self.last_run.isoformat() if self.last_run else None
        }

cleaner_state = CleanerState()


class JobChecker:
    def __init__(self, db_manager=None):
        self.dm = db_manager or DBManager()

        # Global concurrency
        self.global_semaphore = asyncio.Semaphore(MAX_CONCURRENT_CHECKS)

        # Per-domain rate limiting
        self.domain_limits = defaultdict(lambda: asyncio.Semaphore(5))

        # Dedup cache (bounded)
        self.url_cache = {}
        self.MAX_CACHE_SIZE = 10000

        self.stats = {
            "total_checked": 0,
            "cache_hits": 0,
            "dead_detected": 0,
            "total_deleted": 0,
            "skipped_temp": 0,
            "failed_error": 0,
            "start_time": 0,
            "end_time": 0
        }
        self.domain_stats = defaultdict(int)
        self.domain_failures = defaultdict(int)

        self.dead_patterns = [
            "job not found",
            "no longer available",
            "expired",
            "position filled",
            "listing has ended",
            "no longer accepting applications"
        ]

    def get_domain(self, url):
        return urlparse(url).netloc

    async def classify_url(self, client, url):
        domain = self.get_domain(url).lower()
        self.domain_stats[domain] += 1
        
        # Cache
        if url in self.url_cache:
            self.stats["cache_hits"] += 1
            return self.url_cache[url]

        async with self.global_semaphore, self.domain_limits[domain]:
            for attempt in range(CHECK_RETRIES + 1):
                try:
                    resp = await client.get(url)

                    # DEAD (Immediate signals)
                    if resp.status_code == 410:
                        self.url_cache[url] = ("dead", 410)
                        return ("dead", 410)
                    
                    if resp.status_code == 404:
                        self.url_cache[url] = ("dead", 404)
                        return ("dead", 404)

                    if resp.status_code == 200:
                        content_type = resp.headers.get("content-type", "").lower()

                        # Safer Content-Type check (allow missing)
                        if not content_type or "text/html" in content_type:
                            text_lower = resp.text.lower()
                            if any(p in text_lower for p in self.dead_patterns):
                                self.url_cache[url] = ("dead", 200)
                                return ("dead", 200)

                        self.url_cache[url] = ("valid", 200)
                        return ("valid", 200)

                    # RETRYABLE
                    if resp.status_code in (429, 503):
                        if attempt < CHECK_RETRIES:
                            # Domain-aware backoff (Case-insensitive)
                            if "linkedin" in domain:
                                delay = 5 * (attempt + 1)
                            else:
                                delay = 2 ** attempt
                            await asyncio.sleep(delay)
                            continue
                        return "temp_failure"

                    logger.debug(f"⚠️ Failed URL: {url} | status={resp.status_code} | domain={domain}")
                    self.domain_failures[domain] += 1
                    return "error"

                except (httpx.TimeoutException, httpx.NetworkError) as e:
                    if attempt < CHECK_RETRIES:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    logger.debug(f"⌛ Timeout URL: {url} | error={e}")
                    self.domain_failures[domain] += 1
                    return "temp_failure"

                except Exception as e:
                    logger.debug(f"🔥 Error URL: {url} | error={e}")
                    self.domain_failures[domain] += 1
                    return "error"

        return "error"

    async def process_batch(self, client, table, batch):
        tasks = [self.classify_url(client, j["url"]) for j in batch]
        results = await asyncio.gather(*tasks)

        to_update = []
        to_delete = []

        for job, result in zip(batch, results):
            status, code = result if isinstance(result, tuple) else (result, None)
            self.stats["total_checked"] += 1

            if status == "valid":
                if job["missing_count"] > 0:
                    to_update.append((job["serial_no"], 0))

            elif status == "dead":
                self.stats["dead_detected"] += 1
                
                # 🔥 Immediate delete for 410 (guaranteed dead)
                if code == 410:
                    to_delete.append(job["serial_no"])
                    continue

                # ⚠️ Fallback for softer signals (404, content match)
                new_count = job.get("missing_count", 0) + 1

                if new_count >= MAX_MISSING_COUNT:
                    to_delete.append(job["serial_no"])
                else:
                    to_update.append((job["serial_no"], new_count))

            elif status == "temp_failure":
                self.stats["skipped_temp"] += 1
            else:
                self.stats["failed_error"] += 1

        # DB BULK OPS
        if to_update:
            now = datetime.now(UTC)
            up_query = text(f"""
                UPDATE "{DB_SCHEMA}"."{table}"
                SET missing_count = :count,
                    last_checked_at = :now
                WHERE serial_no = :id
            """)
            self.dm.session.execute(
                up_query,
                [
                    {"id": u[0], "count": u[1], "now": now}
                    for u in to_update
                ]
            )

        if to_delete:
            self.dm.session.execute(
                text(f'''
                    DELETE FROM "{DB_SCHEMA}"."{table}"
                    WHERE serial_no = ANY(:ids)
                ''').bindparams(bindparam("ids", type_=ARRAY(Integer))),
                {"ids": to_delete}
            )
            self.stats["total_deleted"] += len(to_delete)

    async def run(self):
        self.stats["start_time"] = time.time()
        
        # Get total count for progress bar (only those due for check)
        total_jobs = 0
        try:
            for table in ["active_scraped_data", "inactive_scraped_data"]:
                query = text(f'''
                    SELECT COUNT(*) FROM "{DB_SCHEMA}"."{table}"
                    WHERE (last_checked_at IS NULL 
                           OR last_checked_at < NOW() - INTERVAL '6 hours')
                ''')
                cnt = self.dm.session.execute(query).scalar()
                total_jobs += cnt or 0
        except Exception as e:
            logger.warning(f"Could not fetch total job count for progress bar: {e}")

        cleaner_state.update(status="running", total=total_jobs, current=0, deleted=0, dead=0, errors=0)

        timeout = httpx.Timeout(10.0, connect=5.0, read=10.0)
        
        pbar = tqdm(total=total_jobs, desc="🧼 Cleaning Job Board", unit="job", colour="green")

        async with httpx.AsyncClient(headers=HEADERS, timeout=timeout) as client:
            for table in ["active_scraped_data", "inactive_scraped_data"]:
                last_id = 0
                
                while True:
                    rows = self.dm.session.execute(
                        text(f'''
                            SELECT serial_no, url, missing_count
                            FROM "{DB_SCHEMA}"."{table}"
                            WHERE serial_no > :last_id
                              AND (last_checked_at IS NULL 
                                   OR last_checked_at < NOW() - INTERVAL '6 hours')
                            ORDER BY serial_no
                            LIMIT :limit
                        '''),
                        {"last_id": last_id, "limit": CHECK_BATCH_SIZE}
                    ).fetchall()

                    if not rows:
                        break

                    batch = [dict(r._mapping) for r in rows]
                    last_id = batch[-1]["serial_no"]

                    await self.process_batch(client, table, batch)
                    pbar.update(len(batch))
                    pbar.set_postfix({
                        "del": self.stats['total_deleted'],
                        "dead": self.stats['dead_detected'],
                        "err": self.stats['failed_error']
                    })
                    
                    # Update global state for frontend visibility
                    cleaner_state.update(
                        current=self.stats['total_checked'],
                        deleted=self.stats['total_deleted'],
                        dead=self.stats['dead_detected'],
                        errors=self.stats['failed_error']
                    )

                    # Memory safety (LRU-style)
                    if len(self.url_cache) > self.MAX_CACHE_SIZE:
                        self.url_cache = dict(list(self.url_cache.items())[-5000:])

                # Commit once per table for efficiency
                self.dm.session.commit()
                # logger.info(f"✅ Table {table} complete.")

        pbar.close()
        self.stats["end_time"] = time.time()
        cleaner_state.update(status="idle", last_run=datetime.now(UTC))
        duration = self.stats["end_time"] - self.stats["start_time"]

        # Global Failure Alerting
        for domain, count in self.domain_failures.items():
            if count > 50:
                logger.warning(f"⚠️ High failure rate detected for domain: {domain} ({count} failures)")

        logger.info(f"""
📊 FINAL CLEANUP SUMMARY:
--------------------------
Total Checked:  {self.stats['total_checked']}
Total Deleted:  {self.stats['total_deleted']}
Dead Detected:  {self.stats['dead_detected']}
Cache Hits:     {self.stats['cache_hits']}
Temp Skipped:   {self.stats['skipped_temp']}
Errors Found:   {self.stats['failed_error']}
Total Duration: {duration:.2f}s
--------------------------
""")

        return self.stats


def run_checker_cleaner_sync():
    checker = JobChecker()
    try:
        return asyncio.run(asyncio.wait_for(checker.run(), timeout=3600))
    finally:
        checker.dm.close()