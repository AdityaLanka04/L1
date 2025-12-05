"""
Fix missing columns in comprehensive_user_profiles table
"""
import sqlite3

def fix_database():
    conn = sqlite3.connect('brainwave_tutor.db')
    cursor = conn.cursor()
    
    # Get existing columns
    cursor.execute("PRAGMA table_info(comprehensive_user_profiles)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    print(f"Existing columns: {existing_columns}")
    
    # Columns that should exist based on the model
    required_columns = {
        'is_college_student': 'BOOLEAN DEFAULT 1',
        'college_level': 'TEXT',
        'major': 'TEXT',
        'main_subject': 'TEXT',
        'preferred_subjects': 'TEXT',
        'brainwave_goal': 'TEXT',
        'difficulty_level': 'TEXT',
        'learning_pace': 'TEXT',
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
    }
    
    # Add missing columns
    for col_name, col_type in required_columns.items():
        if col_name not in existing_columns:
            try:
                sql = f"ALTER TABLE comprehensive_user_profiles ADD COLUMN {col_name} {col_type}"
                cursor.execute(sql)
                print(f"✅ Added column: {col_name}")
            except Exception as e:
                print(f"⚠️ Could not add {col_name}: {e}")
    
    conn.commit()
    conn.close()
    print("\n✅ Database fix completed!")

if __name__ == '__main__':
    fix_database()
