"""
Migration script to add challenger_answers and opponent_answers columns to quiz_battles table
Run this once to update your database schema
Works with both SQLite (local) and PostgreSQL (production)
"""

import os
import sys
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

def is_sqlite(database_url):
    """Check if database is SQLite"""
    return database_url.startswith("sqlite")

def check_column_exists_sqlite(connection, table_name, column_name):
    """Check if column exists in SQLite"""
    try:
        result = connection.execute(text(f"PRAGMA table_info({table_name})"))
        columns = [row[1] for row in result]
        return column_name in columns
    except Exception as e:
        print(f"Error checking column: {e}")
        return False

def check_column_exists_postgres(connection, table_name, column_name):
    """Check if column exists in PostgreSQL"""
    try:
        check_query = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name=:table_name 
            AND column_name=:column_name
        """)
        result = connection.execute(check_query, {"table_name": table_name, "column_name": column_name})
        return result.fetchone() is not None
    except Exception as e:
        print(f"Error checking column: {e}")
        return False

def add_battle_answers_columns():
    """Add answer storage columns to quiz_battles table"""
    
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found in environment variables")
        print("💡 Make sure you have a .env file with DATABASE_URL set")
        sys.exit(1)
    
    print(f"📊 Database type: {'SQLite' if is_sqlite(DATABASE_URL) else 'PostgreSQL'}")
    
    try:
        engine = create_engine(DATABASE_URL)
        is_sqlite_db = is_sqlite(DATABASE_URL)
        
        with engine.connect() as connection:
            # Check if table exists
            inspector = inspect(engine)
            if 'quiz_battles' not in inspector.get_table_names():
                print("⚠️  quiz_battles table does not exist yet")
                print("💡 The table will be created automatically when you run the app")
                return
            
            # Check and add challenger_answers column
            if is_sqlite_db:
                challenger_exists = check_column_exists_sqlite(connection, 'quiz_battles', 'challenger_answers')
                opponent_exists = check_column_exists_sqlite(connection, 'quiz_battles', 'opponent_answers')
            else:
                challenger_exists = check_column_exists_postgres(connection, 'quiz_battles', 'challenger_answers')
                opponent_exists = check_column_exists_postgres(connection, 'quiz_battles', 'opponent_answers')
            
            # Add challenger_answers if it doesn't exist
            if not challenger_exists:
                print("Adding challenger_answers column...")
                try:
                    connection.execute(text("""
                        ALTER TABLE quiz_battles 
                        ADD COLUMN challenger_answers TEXT
                    """))
                    connection.commit()
                    print("✅ Added challenger_answers column")
                except Exception as e:
                    print(f"⚠️  Could not add challenger_answers: {e}")
                    connection.rollback()
            else:
                print("⏭️  challenger_answers column already exists")
            
            # Add opponent_answers if it doesn't exist
            if not opponent_exists:
                print("Adding opponent_answers column...")
                try:
                    connection.execute(text("""
                        ALTER TABLE quiz_battles 
                        ADD COLUMN opponent_answers TEXT
                    """))
                    connection.commit()
                    print("✅ Added opponent_answers column")
                except Exception as e:
                    print(f"⚠️  Could not add opponent_answers: {e}")
                    connection.rollback()
            else:
                print("⏭️  opponent_answers column already exists")
            
            print("\n✅ Migration completed successfully!")
            
    except Exception as e:
        print(f"❌ Error during migration: {str(e)}")
        print(f"💡 Full error: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    print("🔧 Starting database migration...")
    print(f"📊 Database: {DATABASE_URL[:50]}...")
    add_battle_answers_columns()
