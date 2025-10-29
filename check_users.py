import sqlite3

conn = sqlite3.connect('d:\\Brainwave\\L1\\backend\\brainwave_tutor.db')
cursor = conn.cursor()

# Check users table
cursor.execute("SELECT id, username, email FROM users LIMIT 10;")
users = cursor.fetchall()

print("Existing users:")
for user in users:
    print(f"  ID: {user[0]}, Username: {user[1]}, Email: {user[2]}")

if not users:
    print("  No users found!")
    
    # Create a test user
    print("\nCreating test user...")
    cursor.execute("""
        INSERT INTO users (username, email, password_hash, created_at) 
        VALUES (?, ?, ?, datetime('now'))
    """, ('stupendous0512', 'stupendous0512@gmail.com', 'hashed_password'))
    conn.commit()
    print("Test user created!")

conn.close()