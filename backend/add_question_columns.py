import sqlite3
import os

# Connect to the database
db_path = os.path.join(os.path.dirname(__file__), "brainwave_tutor.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Adding missing columns to questions table...")

# Check if columns exist and add them if they don't
columns_to_add = [
    ("points", "INTEGER DEFAULT 1"),
    ("cognitive_level", "VARCHAR(50)"),
    ("estimated_time_seconds", "INTEGER")
]

for column_name, column_type in columns_to_add:
    try:
        # Try to add the column
        cursor.execute(f"ALTER TABLE questions ADD COLUMN {column_name} {column_type}")
        print(f"✓ Added column: {column_name}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print(f"- Column {column_name} already exists, skipping")
        else:
            print(f"✗ Error adding {column_name}: {e}")

conn.commit()
conn.close()

print("\nMigration completed!")
