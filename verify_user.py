import sqlite3
import sys

# Use the backend's database
db_path = 'd:\\Brainwave\\L1\\backend\\brainwave_tutor.db'

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Check if users table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users';")
    if cursor.fetchone():
        print("✓ Users table exists")
        
        # Get all users
        cursor.execute("SELECT id, username, email FROM users;")
        users = cursor.fetchall()
        print(f"\nTotal users: {len(users)}")
        for user in users:
            print(f"  ID: {user[0]}, Username: {user[1]}, Email: {user[2]}")
        
        # Specific lookup
        cursor.execute("SELECT id, username, email FROM users WHERE email = ? OR username = ?;", 
                      ('stupendous0512@gmail.com', 'stupendous0512@gmail.com'))
        user = cursor.fetchone()
        if user:
            print(f"\n✓ Found user: ID={user[0]}, Username={user[1]}, Email={user[2]}")
        else:
            print("\n✗ User not found in database")
    else:
        print("✗ Users table does not exist")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    conn.close()