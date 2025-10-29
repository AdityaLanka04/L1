import sqlite3

db_path = 'd:\\Brainwave\\L1\\backend\\brainwave_tutor.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check the specific user
cursor.execute("SELECT * FROM users WHERE email = ? OR username = ?;", 
              ('stupendous0512@gmail.com', 'stupendous0512@gmail.com'))
user = cursor.fetchone()

if user:
    print("User row:")
    cursor.execute("PRAGMA table_info(users);")
    columns = [row[1] for row in cursor.fetchall()]
    for i, col in enumerate(columns):
        print(f"  {col}: {user[i]}")
else:
    print("User not found!")

conn.close()