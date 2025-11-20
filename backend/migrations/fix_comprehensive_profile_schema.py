"""
Migration to add missing columns to comprehensive_user_profiles table
"""
import sqlite3
import os

def run_migration():
    db_path = os.path.join(os.path.dirname(__file__), '..', 'brainwave_tutor.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if columns exist
        cursor.execute("PRAGMA table_info(comprehensive_user_profiles)")
        columns = [row[1] for row in cursor.fetchall()]
        
        # Add missing columns if they don't exist
        columns_to_add = [
            ('is_college_student', 'BOOLEAN DEFAULT 0'),
            ('college_level', 'TEXT'),
            ('major', 'TEXT'),
            ('main_subject', 'TEXT'),
            ('preferred_subjects', 'TEXT'),
            ('brainwave_goal', 'TEXT'),
            ('difficulty_level', 'TEXT DEFAULT "intermediate"'),
            ('learning_pace', 'TEXT DEFAULT "moderate"'),
            ('best_study_times', 'TEXT'),
            ('weak_areas', 'TEXT'),
            ('strong_areas', 'TEXT'),
            ('quiz_responses', 'TEXT'),
            ('quiz_completed', 'BOOLEAN DEFAULT 0'),
            ('quiz_skipped', 'BOOLEAN DEFAULT 0'),
            ('primary_archetype', 'TEXT'),
            ('secondary_archetype', 'TEXT'),
            ('archetype_scores', 'TEXT'),
            ('archetype_description', 'TEXT'),
        ]
        
        for column_name, column_type in columns_to_add:
            if column_name not in columns:
                print(f"Adding {column_name} column...")
                cursor.execute(f"""
                    ALTER TABLE comprehensive_user_profiles 
                    ADD COLUMN {column_name} {column_type}
                """)
        
        conn.commit()
        print("✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    run_migration()
