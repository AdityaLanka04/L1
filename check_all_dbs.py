import sqlite3
import os

db_files = [
    "d:\\Brainwave\\L1\\brainwave_tutor.db",
    "d:\\Brainwave\\L1\\backend\\brainwave.db",
    "d:\\Brainwave\\L1\\backend\\brainwave_tutor.db"
]

for db_file in db_files:
    print(f"\n{'='*60}")
    print(f"Database: {db_file}")
    print(f"Exists: {os.path.exists(db_file)}")
    print('='*60)
    
    if os.path.exists(db_file):
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        
        # Check if questions table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='questions'")
        if cursor.fetchone():
            print("\nquestions table:")
            cursor.execute("PRAGMA table_info(questions)")
            columns = cursor.fetchall()
            for col in columns:
                print(f"  {col[1]} ({col[2]})")
        else:
            print("\nquestions table: NOT FOUND")
        
        # Check if uploaded_documents table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='uploaded_documents'")
        if cursor.fetchone():
            print("\nuploaded_documents table:")
            cursor.execute("PRAGMA table_info(uploaded_documents)")
            columns = cursor.fetchall()
            for col in columns:
                print(f"  {col[1]} ({col[2]})")
        else:
            print("\nuploaded_documents table: NOT FOUND")
        
        conn.close()