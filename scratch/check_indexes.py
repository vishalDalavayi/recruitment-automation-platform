import sys
import os
# Add root to path
_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, _root)
# Also add backend to path for internal imports within the backend package
sys.path.insert(0, os.path.join(_root, 'backend'))

from sqlalchemy import text
from backend.database import DBManager, DB_SCHEMA


dm = DBManager()
queries = [
    f"SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = '{DB_SCHEMA}';"
]

for q in queries:
    print(f"Executing: {q}")
    res = dm.session.execute(text(q)).fetchall()
    for row in res:
        print(row)
dm.close()
