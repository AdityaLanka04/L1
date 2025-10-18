import sqlite3

conn = sqlite3.connect('brainwave_tutor.db')
cursor = conn.cursor()

try:
    cursor.execute('''
        ALTER TABLE comprehensive_user_profiles 
        ADD COLUMN quiz_responses TEXT
    ''')
    conn.commit()
    print("✅ Successfully added quiz_responses column")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e):
        print("✅ Column quiz_responses already exists")
    else:
        print(f"❌ Error: {e}")

try:
    cursor.execute('''
        ALTER TABLE comprehensive_user_profiles 
        ADD COLUMN preferred_subjects TEXT
    ''')
    conn.commit()
    print("✅ Successfully added preferred_subjects column")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e):
        print("✅ Column preferred_subjects already exists")
    else:
        print(f"❌ Error: {e}")

conn.close()
print("\n✅ Database migration completed!")