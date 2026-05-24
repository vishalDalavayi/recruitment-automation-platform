
import sys
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")
if not db_url:
    # Build from components if DATABASE_URL is missing
    host = os.getenv("DB_HOST")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME")
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASS")
    db_url = f"postgresql://{user}:{password}@{host}:{port}/{name}"

engine = create_engine(db_url)
schema = os.getenv("CANDIDATE_SCHEMA", "candidate_details")

query = text(f'SELECT unique_id, first_name, last_name, raw_resume_path, passport_url, work_authorization_url, id_proof_url FROM "{schema}".candidate_basic_info')

with engine.connect() as conn:
    result = conn.execute(query)
    rows = result.fetchall()
    print("Candidates in DB:")
    print("-" * 100)
    for row in rows:
        print(f"ID: {row[0]}")
        print(f"Name: {row[1]} {row[2]}")
        print(f"Resume Path: {row[3]}")
        print(f"Passport: {row[4]}")
        print(f"Work Auth: {row[5]}")
        print(f"ID Proof: {row[6]}")
        print("-" * 100)
