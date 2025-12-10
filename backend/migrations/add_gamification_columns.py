"""
Migration to add new gamification columns for solo quizzes and flashcard tracking
Works with both SQLite and PostgreSQL
"""
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine

def run_migration():
    """Add new gamification columns"""
    
    columns_to_add = [
        ("user_gamification_stats", "total_solo_quizzes", "INTEGER DEFAULT 0"),
        ("user_gamification_stats", "weekly_solo_quizzes", "INTEGER DEFAULT 0"),
        ("user_gamification_stats", "total_flashcards_reviewed", "INTEGER DEFAULT 0"),
        ("user_gamification_stats", "weekly_flashcards_reviewed", "INTEGER DEFAULT 0"),
        ("user_gamification_stats", "total_flashcards_mastered", "INTEGER DEFAULT 0"),
        ("user_gamification_stats", "weekly_flashcards_mastered", "INTEGER DEFAULT 0"),
    ]
    
    # Detect database type
    db_url = str(engine.url)
    is_sqlite = "sqlite" in db_url.lower()
    
    print(f"Database: {'SQLite' if is_sqlite else 'PostgreSQL'}")
    
    with engine.connect() as conn:
        for table, column, col_type in columns_to_add:
            try:
                if is_sqlite:
                    # SQLite: Check using PRAGMA
                    result = conn.execute(text(f"PRAGMA table_info({table})"))
                    columns = [row[1] for row in result.fetchall()]
                    
                    if column not in columns:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                        print(f"✅ Added column {column} to {table}")
                    else:
                        print(f"⏭️ Column {column} already exists in {table}")
                else:
                    # PostgreSQL: Check using information_schema
                    result = conn.execute(text(f"""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = '{table}' AND column_name = '{column}'
                    """))
                    
                    if result.fetchone() is None:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                        print(f"✅ Added column {column} to {table}")
                    else:
                        print(f"⏭️ Column {column} already exists in {table}")
                    
            except Exception as e:
                print(f"❌ Error adding {column} to {table}: {e}")
        
        conn.commit()
    
    print("\n✅ Migration completed!")

if __name__ == "__main__":
    run_migration()
