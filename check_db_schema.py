import sqlite3

conn = sqlite3.connect('brainwave_tutor.db')
cursor = conn.cursor()

# Check uploaded_documents table schema
print("=== uploaded_documents schema ===")
try:
    cursor.execute("PRAGMA table_info(uploaded_documents)")
    columns = cursor.fetchall()
    for col in columns:
        print(f"  {col[1]} ({col[2]})")
except Exception as e:
    print(f"Error: {e}")

# Check if table exists
print("\n=== All tables ===")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
for table in tables:
    print(f"  {table[0]}")

conn.close()