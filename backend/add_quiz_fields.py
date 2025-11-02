import sqlite3

conn = sqlite3.connect('brainwave_tutor.db')
cursor = conn.cursor()

try:
    cursor.execute('''
        ALTER TABLE comprehensive_user_profiles 
        ADD COLUMN brainwave_goal TEXT
    ''')
    conn.commit()
    print("✅ Successfully added brainwave_goal column")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e):
        print("✅ Column brainwave_goal already exists")
    else:
        print(f"❌ Error: {e}")

try:
    cursor.execute('''
        ALTER TABLE comprehensive_user_profiles 
        ADD COLUMN quiz_completed INTEGER DEFAULT 0
    ''')
    conn.commit()
    print("✅ Successfully added quiz_completed column")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e):
        print("✅ Column quiz_completed already exists")
    else:
        print(f"❌ Error: {e}")

conn.close()
print("\n✅ Database migration completed!")