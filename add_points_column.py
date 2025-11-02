import sqlite3

db_file = 'd:\\Brainwave\\L1\\backend\\brainwave_tutor.db'
conn = sqlite3.connect(db_file)
cursor = conn.cursor()

print(f"Fixing schema for: {db_file}\n")

# Check if points column exists
print("1. Checking questions table...")
cursor.execute("PRAGMA table_info(questions)")
columns = {row[1]: row[2] for row in cursor.fetchall()}
print(f"   Columns: {list(columns.keys())}")

if 'points' in columns:
    print("   ✓ points column already exists")
else:
    print("   ✗ points column missing - adding it")
    try:
        cursor.execute("ALTER TABLE questions ADD COLUMN points INTEGER DEFAULT 1")
        conn.commit()
        print("   ✓ Added points column successfully")
    except Exception as e:
        print(f"   Error: {e}")

if 'cognitive_level' in columns:
    print("   ✓ cognitive_level column already exists")
else:
    print("   ✗ cognitive_level column missing - adding it")
    try:
        cursor.execute("ALTER TABLE questions ADD COLUMN cognitive_level VARCHAR(50)")
        conn.commit()
        print("   ✓ Added cognitive_level column successfully")
    except Exception as e:
        print(f"   Error: {e}")

if 'estimated_time_seconds' in columns:
    print("   ✓ estimated_time_seconds column already exists")
else:
    print("   ✗ estimated_time_seconds column missing - adding it")
    try:
        cursor.execute("ALTER TABLE questions ADD COLUMN estimated_time_seconds INTEGER")
        conn.commit()
        print("   ✓ Added estimated_time_seconds column successfully")
    except Exception as e:
        print(f"   Error: {e}")

# Check uploaded_documents
print("\n2. Checking uploaded_documents table...")
cursor.execute("PRAGMA table_info(uploaded_documents)")
columns = {row[1]: row[2] for row in cursor.fetchall()}
print(f"   Columns: {list(columns.keys())}")

if 'document_metadata' in columns:
    print("   ✓ document_metadata column exists")
elif 'meta_data' in columns:
    print("   ✗ Has meta_data but should be document_metadata")
else:
    print("   ? Neither meta_data nor document_metadata found")

print("\nSchema fix complete!")
conn.close()