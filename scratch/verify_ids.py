
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
tables = ['active_scraped_data', 'inactive_scraped_data']

for t in tables:
    result = dm.session.execute(text(f"SELECT serial_no, title FROM scrapped_data.{t} WHERE serial_no = 790"))
    row = result.fetchone()
    if row:
        print(f"Found 790 in {t}: {row}")
    else:
        print(f"790 NOT found in {t}")

result = dm.session.execute(text(f"SELECT serial_no, title FROM scrapped_data.active_scraped_data WHERE serial_no = 797"))
row = result.fetchone()
if row:
    print(f"Found 797 in active_scraped_data: {row}")
else:
    print(f"797 NOT found in active_scraped_data")

result = dm.session.execute(text(f"SELECT serial_no, title FROM scrapped_data.inactive_scraped_data WHERE serial_no = 797"))
row = result.fetchone()
if row:
    print(f"Found 797 in inactive_scraped_data: {row}")
else:
    print(f"797 NOT found in inactive_scraped_data")
