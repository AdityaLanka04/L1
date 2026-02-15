"""
Migration script to add show_study_insights column to comprehensive_user_profiles table
"""
import sqlite3
import os

def add_show_study_insights_column():
    # Connect to the database
    db_path = os.path.join(os.path.dirname(__file__), 'brainwave_tutor.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(comprehensive_user_profiles)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'show_study_insights' not in columns:
            print("Adding show_study_insights column...")
            cursor.execute("""
                ALTER TABLE comprehensive_user_profiles 
                ADD COLUMN show_study_insights BOOLEAN DEFAULT 1
            """)
            conn.commit()
            print("✓ Successfully added show_study_insights column")
        else:
            print("✓ show_study_insights column already exists")
        
    except Exception as e:
        print(f"✗ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    add_show_study_insights_column()
