
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
query = "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%scraped_data%'"

result = dm.session.execute(text(query))
for row in result:
    print(row)
