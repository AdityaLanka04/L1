import sqlite3

conn = sqlite3.connect('brainwave_tutor.db')
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
tables = cursor.fetchall()
print('📊 Database Tables:')
for table in tables:
    print(f'  ✓ {table[0]}')

# Check question_sets schema
cursor.execute("PRAGMA table_info(question_sets);")
columns = cursor.fetchall()
print('\n📋 question_sets columns:')
for col in columns:
    print(f'  ✓ {col[1]} ({col[2]})')

# Check if source_id exists
has_source_id = any(col[1] == 'source_id' for col in columns)
if has_source_id:
    print('\n❌ ERROR: source_id column still exists!')
else:
    print('\n✅ SUCCESS: source_id column correctly removed!')

conn.close()