import sys
import os

sys.path.insert(
    0,
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"
    ),
)

from database import DBManager, text, DB_SCHEMA
import os

print(f"DB Schema: {DB_SCHEMA}")
print(f"DB Host: {os.getenv('DB_HOST')}")

dm = DBManager()

# Test 1: get_db_tables equivalent
print("\n=== Test: get_db_tables ===")
tables = [
    {
        "name": "input_active",
        "description": "Active vendor search links",
        "type": "input",
    },
    {
        "name": "input_inactive",
        "description": "Inactive vendor job links",
        "type": "input",
    },
    {
        "name": "active_dice_jobs",
        "description": "Discovered jobs from active vendors",
        "type": "discovery",
    },
    {
        "name": "inactive_dice_jobs",
        "description": "Discovered jobs from inactive vendors",
        "type": "discovery",
    },
    {
        "name": "active_scraped_data",
        "description": "Scraped job details (active vendors)",
        "type": "scraped",
    },
    {
        "name": "inactive_scraped_data",
        "description": "Scraped job details (inactive vendors)",
        "type": "scraped",
    },
    {
        "name": "scraper_logs",
        "description": "Historical scraper execution logs",
        "type": "system",
    },
    {
        "name": "candidates",
        "description": "Registered candidate talent pool",
        "type": "talent",
    },
]
table_counts = {}
for t in tables:
    try:
        result = dm.session.execute(
            text(f'SELECT COUNT(*) FROM {DB_SCHEMA}."{t["name"]}"')
        )
        count = result.fetchone()[0]
        table_counts[t["name"]] = count
        print(f"  {t['name']}: {count} rows")
    except Exception as e:
        print(f"  {t['name']}: ERROR - {e}")
        table_counts[t["name"]] = 0

print(f"\nResult: {table_counts}")

# Test 2: get_table_data equivalent for active_scraped_data
print("\n=== Test: get_table_data ===")
table_name = "active_scraped_data"
page = 1
limit = 5
offset = (page - 1) * limit

from database import ActiveScrapedData

cols = ", ".join([c.name for c in ActiveScrapedData.__table__.columns])
print(f"Columns: {cols[:100]}...")

result = dm.session.execute(
    text(f"""
    SELECT {cols} FROM {DB_SCHEMA}.{table_name}
    ORDER BY serial_no DESC
    LIMIT :limit OFFSET :offset
"""),
    {"limit": limit, "offset": offset},
)

rows = result.fetchall()
print(f"Fetched {len(rows)} rows")

# Test 3: get_table_info equivalent
print("\n=== Test: get_table_info ===")
col_info = []
for col in ActiveScrapedData.__table__.columns:
    col_info.append(
        {
            "name": col.name,
            "type": str(col.type),
            "nullable": col.nullable,
            "primary_key": col.primary_key,
        }
    )
print(f"Columns: {[c['name'] for c in col_info]}")

result = dm.session.execute(text(f'SELECT COUNT(*) FROM "{DB_SCHEMA}"."{table_name}"'))
row_count = result.fetchone()[0]
print(f"Row count: {row_count}")

dm.close()
print("\n=== All tests completed ===")
