"""
Complete fix for comprehensive_user_profiles table
"""
import sqlite3
import os

def run_migration():
    db_path = os.path.join(os.path.dirname(__file__), '..', 'brainwave_tutor.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Get existing columns
        cursor.execute("PRAGMA table_info(comprehensive_user_profiles)")
        existing_columns = {row[1] for row in cursor.fetchall()}
        print(f"Existing columns: {existing_columns}")
        
        # All columns that should exist
        required_columns = {
            'id': 'INTEGER PRIMARY KEY',
            'user_id': 'INTEGER UNIQUE',
            'is_college_student': 'BOOLEAN DEFAULT 0',
            'college_level': 'TEXT',
            'major': 'TEXT',
            'main_subject': 'TEXT',
            'preferred_subjects': 'TEXT',
            'brainwave_goal': 'TEXT',
            'difficulty_level': 'TEXT DEFAULT "intermediate"',
            'learning_pace': 'TEXT DEFAULT "moderate"',
            'best_study_times': 'TEXT',
            'weak_areas': 'TEXT',
            'strong_areas': 'TEXT',
            'quiz_responses': 'TEXT',
            'quiz_completed': 'BOOLEAN DEFAULT 0',
            'quiz_skipped': 'BOOLEAN DEFAULT 0',
            'primary_archetype': 'TEXT',
            'secondary_archetype': 'TEXT',
            'archetype_scores': 'TEXT',
            'archetype_description': 'TEXT',
            'created_at': 'DATETIME',
            'updated_at': 'DATETIME',
        }
        
        # Add missing columns
        added = 0
        for column_name, column_type in required_columns.items():
            if column_name not in existing_columns and column_name not in ['id', 'user_id']:
                print(f"Adding column: {column_name}")
                try:
                    cursor.execute(f"""
                        ALTER TABLE comprehensive_user_profiles 
                        ADD COLUMN {column_name} {column_type}
                    """)
                    added += 1
                except sqlite3.OperationalError as e:
                    print(f"  Error: {e}")
        
        conn.commit()
        print(f"\n✅ Added {added} columns successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    run_migration()
