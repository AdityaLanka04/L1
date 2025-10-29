import sqlite3
import sys

conn = sqlite3.connect('brainwave_tutor.db')
cursor = conn.cursor()

print("Checking and fixing database schema mismatches...\n")

# Check if questions table needs the points column (shouldn't need it, but let's verify)
print("1. Checking questions table...")
cursor.execute("PRAGMA table_info(questions)")
columns = {row[1]: row[2] for row in cursor.fetchall()}
print(f"   Columns found: {list(columns.keys())}")

if 'points' in columns:
    print("   ✓ points column exists")
else:
    print("   ✗ points column missing - adding it")
    try:
        cursor.execute("ALTER TABLE questions ADD COLUMN points INTEGER DEFAULT 1")
        conn.commit()
        print("   ✓ Added points column")
    except Exception as e:
        print(f"   Error: {e}")

# Check uploaded_documents table
print("\n2. Checking uploaded_documents table...")
cursor.execute("PRAGMA table_info(uploaded_documents)")
columns = {row[1]: row[2] for row in cursor.fetchall()}
print(f"   Columns found: {list(columns.keys())}")

if 'document_metadata' in columns:
    print("   ✓ document_metadata column exists")
elif 'meta_data' in columns:
    print("   ✗ meta_data column exists but should be document_metadata")
    print("   Renaming meta_data to document_metadata...")
    try:
        # SQLite doesn't support direct column rename in older versions, need to recreate table
        cursor.execute("""
            CREATE TABLE uploaded_documents_new (
                id INTEGER PRIMARY KEY,
                user_id INTEGER,
                filename VARCHAR(255),
                document_type VARCHAR(50),
                content TEXT,
                document_metadata TEXT,
                created_at DATETIME,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        """)
        cursor.execute("""
            INSERT INTO uploaded_documents_new 
            SELECT id, user_id, filename, document_type, content, meta_data, created_at 
            FROM uploaded_documents
        """)
        cursor.execute("DROP TABLE uploaded_documents")
        cursor.execute("ALTER TABLE uploaded_documents_new RENAME TO uploaded_documents")
        conn.commit()
        print("   ✓ Renamed meta_data to document_metadata")
    except Exception as e:
        print(f"   Error: {e}")
else:
    print("   ✗ Neither meta_data nor document_metadata exists!")

print("\nSchema check complete!")
conn.close()