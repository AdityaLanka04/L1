import sqlite3
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")
db_file = DATABASE_URL.replace("sqlite:///", "").replace("sqlite://", "")

print("=" * 60)
print("FIXING LEARNING_REVIEWS TABLE")
print("=" * 60)
print(f"Database: {db_file}")

try:
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    print("\n[1/3] Checking current table structure...")
    cursor.execute("PRAGMA table_info(learning_reviews)")
    columns = cursor.fetchall()
    column_names = [col[1] for col in columns]
    
    print(f"   Current columns: {len(column_names)}")
    for col in column_names:
        print(f"      - {col}")
    
    print("\n[2/3] Adding missing column...")
    if 'source_slides' not in column_names:
        cursor.execute("ALTER TABLE learning_reviews ADD COLUMN source_slides TEXT")
        print("   SUCCESS: Added 'source_slides' column")
    else:
        print("   INFO: Column 'source_slides' already exists")
    
    conn.commit()
    
    print("\n[3/3] Verifying update...")
    cursor.execute("PRAGMA table_info(learning_reviews)")
    updated_columns = cursor.fetchall()
    updated_column_names = [col[1] for col in updated_columns]
    
    if 'source_slides' in updated_column_names:
        print("   SUCCESS: Column verified")
    else:
        print("   ERROR: Column not found after update")
    
    print("\n" + "=" * 60)
    print("UPDATED TABLE STRUCTURE")
    print("=" * 60)
    for col in updated_columns:
        print(f"   {col[1]:30s} {col[2]:20s} {'NOT NULL' if col[3] else 'NULL'}")
    
    conn.close()
    
    print("\n" + "=" * 60)
    print("FIX COMPLETED SUCCESSFULLY")
    print("=" * 60)
    print("You can now restart your application")
    print("=" * 60)
    
except Exception as e:
    print("\n" + "=" * 60)
    print("ERROR")
    print("=" * 60)
    print(f"Error: {str(e)}")
    import traceback
    traceback.print_exc()