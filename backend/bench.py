"""Quick benchmark for API endpoints."""
import urllib.request
import time
import json

BASE = "http://localhost:8000"

endpoints = [
    ("/health", "Health"),
    ("/status", "Status"),
    ("/stats", "Stats (cold)"),
    ("/stats", "Stats (cached)"),
    ("/candidates?page=1&limit=10", "Candidates (cold)"),
    ("/candidates?page=1&limit=10", "Candidates (warm)"),
    ("/jobs?page=1&limit=10", "Jobs (cold)"),
    ("/jobs?page=1&limit=10", "Jobs (warm)"),
]

print(f"{'Endpoint':<22s} {'Time':>10s}  {'Size':>8s}  Notes")
print("-" * 60)

for path, label in endpoints:
    s = time.time()
    try:
        r = urllib.request.urlopen(f"{BASE}{path}", timeout=60)
        data = r.read()
        ms = (time.time() - s) * 1000
        notes = ""
        try:
            d = json.loads(data)
            if "total" in d:
                notes = f"total={d['total']}"
            if "candidates" in d:
                notes += f" items={len(d['candidates'])}"
        except Exception:
            pass
        print(f"{label:<22s} {ms:>8.0f}ms  {len(data):>6} B  {notes}")
    except Exception as e:
        ms = (time.time() - s) * 1000
        print(f"{label:<22s} {ms:>8.0f}ms  {'FAIL':>6}    {e}")
