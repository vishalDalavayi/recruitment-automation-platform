
import sys
import os
from dotenv import load_dotenv

# Add root and backend to path
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _root)
sys.path.insert(0, os.path.join(_root, 'backend'))

load_dotenv(os.path.join(_root, 'backend', '.env'))

from backend.database import DBManager

dm = DBManager()
print("Testing 790, inactive...")
detail = dm.get_job_detail(790, "inactive")
if detail:
    print(f"Detail found: {detail['title']} from {detail.get('vendor')}")
else:
    print("Detail NOT found for 790, inactive")

print("Testing 797, inactive...")
detail = dm.get_job_detail(797, "inactive")
if detail:
    print(f"Detail found: {detail['title']} from {detail.get('vendor')}")
else:
    print("Detail NOT found for 797, inactive")
