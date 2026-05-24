
import os
import sys
from dotenv import load_dotenv
import sqlalchemy
from sqlalchemy import create_engine, text

# Add backend to path relative to this script
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_root, 'backend'))

load_dotenv(os.path.join(_root, 'backend', '.env'))


DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")

hosts = [os.getenv("DB_HOST"), "localhost", "127.0.0.1"]

for host in hosts:
    if not host: continue
    url = f"postgresql://{DB_USER}:{DB_PASS}@{host}:{DB_PORT}/{DB_NAME}"
    print(f"Connecting to {host}...")
    try:
        engine = create_engine(url, connect_args={'connect_timeout': 3})
        with engine.connect() as conn:
            res = conn.execute(text("SELECT 1"))
            print(f"Connection to {host} successful!")
            print(res.fetchone())
            break
    except Exception as e:
        print(f"Connection to {host} failed: {e}")
