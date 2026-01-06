"""
Migration script to add share_code column to flashcard_sets table.
Run: python add_share_code_column.py
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text
from database import engine

def add_share_code_column():
    """Add share_code column to flashcard_sets if it doesn't exist"""
    
    with engine.connect() as conn:
        # Check if column exists
        check_query = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'flashcard_sets' AND column_name = 'share_code'
        """)
        
        result = conn.execute(check_query).fetchone()
        
        if result:
            print("✅ share_code column already exists")
            return
        
        # Add the column
        print("Adding share_code column to flashcard_sets...")
        
        alter_query = text("""
            ALTER TABLE flashcard_sets 
            ADD COLUMN share_code VARCHAR(6) UNIQUE
        """)
        
        conn.execute(alter_query)
        conn.commit()
        
        # Create index
        index_query = text("""
            CREATE INDEX IF NOT EXISTS ix_flashcard_sets_share_code 
            ON flashcard_sets (share_code)
        """)
        conn.execute(index_query)
        conn.commit()
        
        print("✅ share_code column added successfully")


if __name__ == "__main__":
    add_share_code_column()
