import sqlite3

conn = sqlite3.connect('brainwave_tutor.db')
cursor = conn.cursor()

# Get user info
cursor.execute("SELECT id, email, first_name FROM users WHERE email LIKE '%stupendous%'")
users = cursor.fetchall()
print("Users:", users)

if users:
    user_id = users[0][0]
    
    # Get gamification stats
    cursor.execute("""
        SELECT user_id, total_ai_chats, weekly_ai_chats, total_points, level 
        FROM user_gamification_stats 
        WHERE user_id = ?
    """, (user_id,))
    stats = cursor.fetchall()
    print("\nGamification Stats:", stats)
    
    # Get recent point transactions
    cursor.execute("""
        SELECT id, activity_type, points_earned, description, created_at 
        FROM point_transactions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 10
    """, (user_id,))
    transactions = cursor.fetchall()
    print("\nRecent Transactions:")
    for t in transactions:
        print(f"  {t}")
    
    # Get chat sessions
    cursor.execute("""
        SELECT id, title, created_at 
        FROM chat_sessions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 5
    """, (user_id,))
    chats = cursor.fetchall()
    print("\nRecent Chat Sessions:")
    for c in chats:
        print(f"  {c}")
    
    # Get chat messages
    if chats:
        chat_id = chats[0][0]
        cursor.execute("""
            SELECT id, user_message, ai_response, timestamp 
            FROM chat_messages 
            WHERE chat_session_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 5
        """, (chat_id,))
        messages = cursor.fetchall()
        print(f"\nMessages in Chat {chat_id}:")
        for m in messages:
            print(f"  ID: {m[0]}, User: {m[1][:50]}..., AI: {m[2][:50]}...")

conn.close()
