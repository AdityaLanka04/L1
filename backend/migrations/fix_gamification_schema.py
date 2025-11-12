"""
Migration: Fix gamification schema - add missing columns
Adds missing columns to user_gamification_stats and point_transactions tables
"""

import sqlite3
import os

def migrate():
    # Get database path
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'brainwave_tutor.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("=" * 60)
        print("FIXING GAMIFICATION SCHEMA")
        print("=" * 60)
        
        # Fix user_gamification_stats table
        print("\n1. Checking user_gamification_stats table...")
        cursor.execute("PRAGMA table_info(user_gamification_stats)")
        columns = [col[1] for col in cursor.fetchall()]
        
        gamification_columns = {
            'weekly_ai_chats': 'INTEGER DEFAULT 0',
            'weekly_notes_created': 'INTEGER DEFAULT 0',
            'weekly_questions_answered': 'INTEGER DEFAULT 0',
            'weekly_quizzes_completed': 'INTEGER DEFAULT 0',
            'weekly_flashcards_created': 'INTEGER DEFAULT 0',
            'weekly_study_minutes': 'INTEGER DEFAULT 0',
            'weekly_battles_won': 'INTEGER DEFAULT 0',
            'total_ai_chats': 'INTEGER DEFAULT 0',
            'total_notes_created': 'INTEGER DEFAULT 0',
            'total_questions_answered': 'INTEGER DEFAULT 0',
            'total_quizzes_completed': 'INTEGER DEFAULT 0',
            'total_flashcards_created': 'INTEGER DEFAULT 0',
            'total_study_minutes': 'INTEGER DEFAULT 0',
            'total_battles_won': 'INTEGER DEFAULT 0',
            'current_streak': 'INTEGER DEFAULT 0',
            'longest_streak': 'INTEGER DEFAULT 0',
            'last_activity_date': 'DATE',
            'week_start_date': 'DATE',
        }
        
        for col_name, col_type in gamification_columns.items():
            if col_name not in columns:
                print(f"   Adding {col_name}...")
                cursor.execute(f"ALTER TABLE user_gamification_stats ADD COLUMN {col_name} {col_type}")
                print(f"   ✓ Added {col_name}")
            else:
                print(f"   ✓ {col_name} already exists")
        
        # Fix point_transactions table
        print("\n2. Checking point_transactions table...")
        cursor.execute("PRAGMA table_info(point_transactions)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'points_earned' not in columns:
            print("   Adding points_earned column...")
            cursor.execute("ALTER TABLE point_transactions ADD COLUMN points_earned INTEGER DEFAULT 0")
            print("   ✓ Added points_earned column")
        else:
            print("   ✓ points_earned column already exists")
        
        if 'activity_metadata' not in columns:
            print("   Adding activity_metadata column...")
            cursor.execute("ALTER TABLE point_transactions ADD COLUMN activity_metadata TEXT")
            print("   ✓ Added activity_metadata column")
        else:
            print("   ✓ activity_metadata column already exists")
        
        conn.commit()
        print("\n" + "=" * 60)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
