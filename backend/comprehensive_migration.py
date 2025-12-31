"""
Comprehensive Database Migration Script
Checks all tables and adds missing columns based on models.py
Run this: python backend/comprehensive_migration.py
"""

import os
import sqlite3
from sqlalchemy import create_engine, inspect, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")

def get_db_path():
    """Get the actual database file path"""
    if "sqlite" in DATABASE_URL:
        # Extract path from sqlite:///./path/to/db.db
        db_path = DATABASE_URL.replace("sqlite:///", "")
        if db_path.startswith("./"):
            db_path = db_path[2:]
        
        # Check multiple possible locations
        possible_paths = [
            os.path.join(os.path.dirname(__file__), db_path),
            os.path.join(os.path.dirname(__file__), 'brainwave_tutor.db'),
            os.path.join(os.path.dirname(__file__), 'brainwave.db'),
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return path
        
        # Return the first path (will be created if doesn't exist)
        return possible_paths[0]
    else:
        return None  # PostgreSQL

def check_column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table"""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]
    return column_name in columns

def add_column_if_missing(cursor, table_name, column_name, column_type, default_value=None):
    """Add a column if it doesn't exist"""
    if check_column_exists(cursor, table_name, column_name):
        print(f"  ✓ {table_name}.{column_name} already exists")
        return False
    
    try:
        default_clause = ""
        if default_value is not None:
            if isinstance(default_value, bool):
                default_clause = f" DEFAULT {1 if default_value else 0}"
            elif isinstance(default_value, (int, float)):
                default_clause = f" DEFAULT {default_value}"
            elif isinstance(default_value, str):
                default_clause = f" DEFAULT '{default_value}'"
        
        sql = f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}{default_clause}"
        cursor.execute(sql)
        print(f"   Added {table_name}.{column_name} ({column_type})")
        return True
    except sqlite3.OperationalError as e:
        print(f"   Error adding {table_name}.{column_name}: {e}")
        return False

def run_comprehensive_migration():
    """Run comprehensive migration for all tables"""
    
    # Force SQLite check for local development
    db_path = get_db_path()
    
    if db_path and os.path.exists(db_path):
        print(f" Running SQLite migration on: {db_path}")
        run_sqlite_migration(db_path)
    elif "postgres" in DATABASE_URL:
        print(" PostgreSQL detected - using SQLAlchemy approach")
        run_postgres_migration()
    else:
        print(f" Database not found")

def run_sqlite_migration(db_path):
    """Run SQLite migration"""
    print("=" * 80)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    changes_made = 0
    
    try:
        # ==================== FLASHCARD_SETS ====================
        print("\n📋 Checking flashcard_sets table...")
        changes_made += add_column_if_missing(cursor, "flashcard_sets", "is_public", "BOOLEAN", False)
        
        # ==================== USERS ====================
        print("\n📋 Checking users table...")
        changes_made += add_column_if_missing(cursor, "users", "picture_url", "VARCHAR(255)", None)
        changes_made += add_column_if_missing(cursor, "users", "google_user", "BOOLEAN", False)
        changes_made += add_column_if_missing(cursor, "users", "last_login", "DATETIME", None)
        
        # ==================== NOTES ====================
        print("\n📋 Checking notes table...")
        changes_made += add_column_if_missing(cursor, "notes", "media_file_id", "INTEGER", None)
        changes_made += add_column_if_missing(cursor, "notes", "is_favorite", "BOOLEAN", False)
        changes_made += add_column_if_missing(cursor, "notes", "is_deleted", "BOOLEAN", False)
        changes_made += add_column_if_missing(cursor, "notes", "deleted_at", "DATETIME", None)
        changes_made += add_column_if_missing(cursor, "notes", "custom_font", "VARCHAR(50)", "Inter")
        changes_made += add_column_if_missing(cursor, "notes", "transcript", "TEXT", None)
        changes_made += add_column_if_missing(cursor, "notes", "analysis", "TEXT", None)
        changes_made += add_column_if_missing(cursor, "notes", "flashcards", "TEXT", None)
        changes_made += add_column_if_missing(cursor, "notes", "quiz_questions", "TEXT", None)
        changes_made += add_column_if_missing(cursor, "notes", "key_moments", "TEXT", None)
        
        # ==================== FLASHCARDS ====================
        print("\n📋 Checking flashcards table...")
        changes_made += add_column_if_missing(cursor, "flashcards", "marked_for_review", "BOOLEAN", False)
        changes_made += add_column_if_missing(cursor, "flashcards", "difficulty", "VARCHAR(20)", "medium")
        changes_made += add_column_if_missing(cursor, "flashcards", "category", "VARCHAR(50)", "general")
        changes_made += add_column_if_missing(cursor, "flashcards", "times_reviewed", "INTEGER", 0)
        changes_made += add_column_if_missing(cursor, "flashcards", "correct_count", "INTEGER", 0)
        changes_made += add_column_if_missing(cursor, "flashcards", "last_reviewed", "DATETIME", None)
        
        # ==================== ACTIVITIES ====================
        print("\n📋 Checking activities table...")
        changes_made += add_column_if_missing(cursor, "activities", "question_type", "VARCHAR(50)", None)
        changes_made += add_column_if_missing(cursor, "activities", "difficulty_level", "VARCHAR(50)", None)
        changes_made += add_column_if_missing(cursor, "activities", "user_satisfaction", "INTEGER", None)
        changes_made += add_column_if_missing(cursor, "activities", "time_to_understand", "REAL", None)
        changes_made += add_column_if_missing(cursor, "activities", "follow_up_questions", "INTEGER", 0)
        
        # ==================== USER_STATS ====================
        print("\n📋 Checking user_stats table...")
        changes_made += add_column_if_missing(cursor, "user_stats", "total_lessons", "INTEGER", 0)
        changes_made += add_column_if_missing(cursor, "user_stats", "total_hours", "REAL", 0.0)
        changes_made += add_column_if_missing(cursor, "user_stats", "day_streak", "INTEGER", 0)
        changes_made += add_column_if_missing(cursor, "user_stats", "accuracy_percentage", "REAL", 0.0)
        changes_made += add_column_if_missing(cursor, "user_stats", "last_activity", "DATETIME", None)
        
        # ==================== CHAT_SESSIONS ====================
        print("\n📋 Checking chat_sessions table...")
        changes_made += add_column_if_missing(cursor, "chat_sessions", "folder_id", "INTEGER", None)
        
        # ==================== FOLDERS ====================
        print("\n📋 Checking folders table...")
        changes_made += add_column_if_missing(cursor, "folders", "parent_id", "INTEGER", None)
        changes_made += add_column_if_missing(cursor, "folders", "color", "VARCHAR(50)", "#D7B38C")
        
        # ==================== CHAT_FOLDERS ====================
        print("\n📋 Checking chat_folders table...")
        if check_table_exists(cursor, "chat_folders"):
            changes_made += add_column_if_missing(cursor, "chat_folders", "parent_id", "INTEGER", None)
            changes_made += add_column_if_missing(cursor, "chat_folders", "color", "VARCHAR(50)", "#D7B38C")
        
        # ==================== COMPREHENSIVE_USER_PROFILE ====================
        print("\n📋 Checking comprehensive_user_profile table...")
        if check_table_exists(cursor, "comprehensive_user_profile"):
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "preferred_subjects", "TEXT", "[]")
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "difficulty_level", "VARCHAR(50)", "intermediate")
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "study_schedule", "VARCHAR(50)", "flexible")
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "learning_pace", "VARCHAR(50)", "moderate")
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "motivation_factors", "TEXT", "[]")
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "weak_areas", "TEXT", "[]")
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "strong_areas", "TEXT", "[]")
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "career_goals", "TEXT", None)
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "study_goals", "TEXT", None)
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "time_zone", "VARCHAR(50)", None)
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "study_environment", "VARCHAR(50)", "quiet")
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "preferred_language", "VARCHAR(50)", "english")
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "preferred_session_length", "INTEGER", None)
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "best_study_times", "TEXT", "[]")
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "primary_archetype", "VARCHAR(50)", "")
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "secondary_archetype", "VARCHAR(50)", "")
            changes_made += add_column_if_missing(cursor, "comprehensive_user_profile", "archetype_description", "TEXT", "")
        
        # ==================== DAILY_LEARNING_METRICS ====================
        print("\n📋 Checking daily_learning_metrics table...")
        if check_table_exists(cursor, "daily_learning_metrics"):
            changes_made += add_column_if_missing(cursor, "daily_learning_metrics", "sessions_completed", "INTEGER", 0)
            changes_made += add_column_if_missing(cursor, "daily_learning_metrics", "time_spent_minutes", "REAL", 0.0)
            changes_made += add_column_if_missing(cursor, "daily_learning_metrics", "questions_answered", "INTEGER", 0)
            changes_made += add_column_if_missing(cursor, "daily_learning_metrics", "correct_answers", "INTEGER", 0)
            changes_made += add_column_if_missing(cursor, "daily_learning_metrics", "topics_studied", "TEXT", "[]")
            changes_made += add_column_if_missing(cursor, "daily_learning_metrics", "accuracy_rate", "REAL", 0.0)
            changes_made += add_column_if_missing(cursor, "daily_learning_metrics", "engagement_score", "REAL", 0.0)
            changes_made += add_column_if_missing(cursor, "daily_learning_metrics", "difficulty_level_attempted", "VARCHAR(50)", None)
        
        # ==================== MEDIA_FILES ====================
        print("\n📋 Checking media_files table...")
        if check_table_exists(cursor, "media_files"):
            changes_made += add_column_if_missing(cursor, "media_files", "file_type", "VARCHAR(20)", None)
            changes_made += add_column_if_missing(cursor, "media_files", "original_filename", "VARCHAR(255)", None)
            changes_made += add_column_if_missing(cursor, "media_files", "file_size", "INTEGER", None)
            changes_made += add_column_if_missing(cursor, "media_files", "storage_path", "VARCHAR(500)", None)
            changes_made += add_column_if_missing(cursor, "media_files", "storage_type", "VARCHAR(20)", None)
            changes_made += add_column_if_missing(cursor, "media_files", "extracted_text", "TEXT", None)
            changes_made += add_column_if_missing(cursor, "media_files", "language", "VARCHAR(10)", None)
            changes_made += add_column_if_missing(cursor, "media_files", "duration", "INTEGER", None)
            changes_made += add_column_if_missing(cursor, "media_files", "page_count", "INTEGER", None)
            changes_made += add_column_if_missing(cursor, "media_files", "word_count", "INTEGER", 0)
        
        # Commit all changes
        conn.commit()
        
        print("\n" + "=" * 80)
        if changes_made > 0:
            print(f" Migration completed successfully! {changes_made} columns added.")
        else:
            print(" Database schema is up to date. No changes needed.")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n Migration failed: {e}")
        conn.rollback()
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

def check_table_exists(cursor, table_name):
    """Check if a table exists"""
    cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'")
    return cursor.fetchone() is not None

def run_postgres_migration():
    """Run migration for PostgreSQL"""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as connection:
        try:
            print(" Running PostgreSQL migration...")
            
            # Add is_public to flashcard_sets
            try:
                connection.execute(text("""
                    ALTER TABLE flashcard_sets 
                    ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE
                """))
                connection.commit()
                print(" Added is_public column to flashcard_sets")
            except Exception as e:
                print(f" flashcard_sets.is_public: {e}")
            
            # Add other missing columns as needed
            # ... (add more PostgreSQL-specific migrations here)
            
            print(" PostgreSQL migration completed")
            
        except Exception as e:
            print(f" PostgreSQL migration failed: {e}")
            connection.rollback()

if __name__ == "__main__":
    print(" Starting Comprehensive Database Migration")
    print("=" * 80)
    
    # Check if we're using SQLite locally
    if "sqlite" in DATABASE_URL or not DATABASE_URL.startswith("postgres"):
        # Force SQLite migration for local development
        print(" Detected local SQLite database")
        db_path = get_db_path()
        if db_path and os.path.exists(db_path):
            print(f"📂 Database location: {db_path}")
            # Temporarily override to use SQLite migration
            original_url = DATABASE_URL
            run_comprehensive_migration()
        else:
            print(" SQLite database not found")
    else:
        run_comprehensive_migration()
