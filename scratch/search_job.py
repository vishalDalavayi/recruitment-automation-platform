
import sys
import os

# Add root and backend to path
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _root)
sys.path.insert(0, os.path.join(_root, 'backend'))

from backend.database import DBManager

dm = DBManager()
tables = ['active_scraped_data', 'inactive_scraped_data']
found = False

for t in tables:
    model = dm._get_model_by_table(t)
    job = dm.session.query(model).filter(model.title.ilike('%ERP Technical%')).first()
    if job:
        print(f"Found in {t}: {job.url}")
        print(f"Description length: {len(job.description) if job.description else 0}")
        print(f"Description start: {job.description[:100] if job.description else 'None'}")
        found = True
        break

if not found:
    print("Not Found")
