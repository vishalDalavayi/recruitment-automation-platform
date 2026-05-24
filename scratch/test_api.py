import requests

BASE_URL = "http://localhost:8000"

# Test health endpoint
try:
    r = requests.get(f"{BASE_URL}/", timeout=5)
    print(f"GET /: {r.status_code}")
    print(f"Response: {r.text[:200]}")
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")

# Test /db/tables
try:
    r = requests.get(f"{BASE_URL}/db/tables", timeout=10)
    print(f"\nGET /db/tables: {r.status_code}")
    print(f"Response: {r.text[:500]}")
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
