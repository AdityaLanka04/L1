import sqlite3
import os

db_path = './brainwave_tutor.db'

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if column exists
    cursor.execute("PRAGMA table_info(comprehensive_user_profiles)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'quiz_responses' not in columns:
        print("Adding quiz_responses column...")
        cursor.execute("""
            ALTER TABLE comprehensive_user_profiles 
            ADD COLUMN quiz_responses TEXT
        """)
        conn.commit()
        print("✅ Column added successfully!")
    else:
        print("✅ Column already exists!")
    
    conn.close()
else:
    print(f"❌ Database not found at {db_path}")