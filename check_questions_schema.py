import sqlite3

conn = sqlite3.connect('brainwave_tutor.db')
cursor = conn.cursor()

# Check questions table schema
print("=== questions table schema ===")
try:
    cursor.execute("PRAGMA table_info(questions)")
    columns = cursor.fetchall()
    for col in columns:
        print(f"  {col[1]} ({col[2]})")
except Exception as e:
    print(f"Error: {e}")

conn.close()