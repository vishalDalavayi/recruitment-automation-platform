
import sys
import os

# Add the current directory to sys.path to import app modules
sys.path.append(os.path.abspath(os.getcwd()))

from app.models.base import engine, CANDIDATE_SCHEMA
from sqlalchemy import text

def add_created_at_column():
    print(f"Connecting to database to add 'created_at' column in schema '{CANDIDATE_SCHEMA}'...")
    try:
        with engine.connect() as conn:
            # Check if column exists
            check_query = text(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = '{CANDIDATE_SCHEMA}' 
                AND table_name = 'candidate_basic_info' 
                AND column_name = 'created_at'
            """)
            result = conn.execute(check_query).fetchone()
            
            if result:
                print("Column 'created_at' already exists.")
            else:
                print("Adding column 'created_at'...")
                alter_query = text(f'ALTER TABLE "{CANDIDATE_SCHEMA}".candidate_basic_info ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL')
                conn.execute(alter_query)
                conn.commit()
                print("Column 'created_at' added successfully.")
                
    except Exception as e:
        print(f"Error adding column: {e}")

if __name__ == "__main__":
    add_created_at_column()
