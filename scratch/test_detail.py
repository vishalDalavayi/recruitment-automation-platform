
import sys
import os

# Add root and backend to path
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _root)
sys.path.insert(0, os.path.join(_root, 'backend'))

from backend.database import DBManager, text

dm = DBManager()
# Found in inactive_scraped_data: https://www.dice.com/job-detail/08559f64-b972-4cba-abeb-1ebb4e8cf369

job = dm.session.execute(text("SELECT * FROM scrapped_data.inactive_scraped_data WHERE title ILIKE '%ERP Technical%'")).fetchone()
if job:
    serial_no = job._mapping['serial_no']
    print(f"Serial No: {serial_no}")
    detail = dm.get_job_detail(serial_no, 'inactive')
    if detail:
        print(f"Detail found: {detail.get('title')}")
        print(f"Description present: {'description' in detail}")
        print(f"Description value: {detail.get('description')[:50] if detail.get('description') else 'None'}")
    else:
        print("Detail not found via dm.get_job_detail")
else:
    print("Job not found in DB at all")
