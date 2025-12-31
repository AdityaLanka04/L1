"""
Migration script to add is_public column to flashcard_sets table
Run this once: python backend/add_is_public_column.py
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")

def add_is_public_column():
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
    
    with engine.connect() as connection:
        try:
            # Check if column already exists
            if "sqlite" in DATABASE_URL:
                result = connection.execute(text("PRAGMA table_info(flashcard_sets)"))
                columns = [row[1] for row in result.fetchall()]
                
                if 'is_public' not in columns:
                    print("Adding is_public column to flashcard_sets table...")
                    connection.execute(text(
                        "ALTER TABLE flashcard_sets ADD COLUMN is_public BOOLEAN DEFAULT 0"
                    ))
                    connection.commit()
                    print(" Successfully added is_public column")
                else:
                    print(" is_public column already exists")
            
            else:  # PostgreSQL
                # Check if column exists
                result = connection.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='flashcard_sets' AND column_name='is_public'
                """))
                
                if result.rowcount == 0:
                    print("Adding is_public column to flashcard_sets table...")
                    connection.execute(text(
                        "ALTER TABLE flashcard_sets ADD COLUMN is_public BOOLEAN DEFAULT FALSE"
                    ))
                    connection.commit()
                    print(" Successfully added is_public column")
                else:
                    print(" is_public column already exists")
                    
        except Exception as e:
            print(f" Error: {e}")
            connection.rollback()
        finally:
            connection.close()

if __name__ == "__main__":
    print(" Running migration to add is_public column...")
    add_is_public_column()
    print(" Migration complete!")
