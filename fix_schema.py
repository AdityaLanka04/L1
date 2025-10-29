import sqlite3

conn = sqlite3.connect('d:\\Brainwave\\L1\\backend\\brainwave_tutor.db')
cursor = conn.cursor()

# Check question_sets table structure
cursor.execute("PRAGMA table_info(question_sets);")
columns = cursor.fetchall()
print("Current question_sets columns:")
existing_cols = {col[1] for col in columns}
for col in columns:
    print(f"  {col[1]}: {col[2]}")

# Required columns based on model
required_cols = {
    'id': 'INTEGER PRIMARY KEY',
    'user_id': 'INTEGER',
    'title': 'VARCHAR(255)',
    'description': 'TEXT',
    'source_type': 'VARCHAR(50)',
    'source_id': 'INTEGER',
    'total_questions': 'INTEGER',
    'best_score': 'INTEGER',
    'attempts': 'INTEGER',
    'created_at': 'DATETIME',
    'updated_at': 'DATETIME'
}

# Add missing columns
for col_name, col_type in required_cols.items():
    if col_name not in existing_cols:
        print(f"\nAdding missing column: {col_name} ({col_type})")
        if col_name in ['best_score', 'attempts', 'total_questions']:
            cursor.execute(f"ALTER TABLE question_sets ADD COLUMN {col_name} {col_type.replace('INTEGER', 'INTEGER DEFAULT 0')};")
        else:
            cursor.execute(f"ALTER TABLE question_sets ADD COLUMN {col_name} {col_type};")
        conn.commit()

conn.close()
print("\nSchema updated!")