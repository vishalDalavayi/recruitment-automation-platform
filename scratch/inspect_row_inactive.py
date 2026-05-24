
import sys
import os
from dotenv import load_dotenv

# Add root and backend to path
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _root)
sys.path.insert(0, os.path.join(_root, 'backend'))

load_dotenv(os.path.join(_root, 'backend', '.env'))

from backend.database import DBManager, text


dm = DBManager()
cols = "s.title, s.company, s.location, s.job_type, s.posted_date, s.keyword"
query = f"SELECT {cols}, i.vendor_name, 'inactive' as type, s.serial_no FROM scrapped_data.inactive_scraped_data s JOIN scrapped_data.input_inactive i ON s.keyword = i.dice_job_link LIMIT 1"

result = dm.session.execute(text(query))
row = result.fetchone()
if row:
    print(f"Row length: {len(row)}")
    print(f"Row keys (columns): {row._mapping.keys()}")
    print(f"Row values: {list(row)}")
else:
    print("No row found in inactive_scraped_data")
