import sqlite3

conn = sqlite3.connect('d:\\Brainwave\\L1\\backend\\brainwave_tutor.db')
cursor = conn.cursor()

# Check question_sets table structure
cursor.execute("PRAGMA table_info(question_sets);")
columns = cursor.fetchall()
print("Current question_sets columns:")
for col in columns:
    print(f"  {col[1]}: {col[2]}")

# Check if source_id column exists
has_source_id = any(col[1] == 'source_id' for col in columns)
print(f"\nHas source_id column: {has_source_id}")

if not has_source_id:
    print("\nAdding source_id column...")
    cursor.execute("ALTER TABLE question_sets ADD COLUMN source_id INTEGER;")
    conn.commit()
    print("Column added!")

conn.close()