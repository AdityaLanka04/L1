"""
Test the complete message flow
"""
import sqlite3
from datetime import datetime

conn = sqlite3.connect('brainwave_tutor.db')
cursor = conn.cursor()

print("🔍 CHECKING MESSAGE FLOW\n")

# Get user
cursor.execute("SELECT id, email FROM users WHERE email LIKE '%stupendous%'")
user = cursor.fetchone()
if not user:
    print("❌ No user found")
    conn.close()
    exit()

user_id = user[0]
print(f"✅ User: {user[1]} (ID: {user_id})\n")

# Check chat sessions
cursor.execute("""
    SELECT id, title, created_at, updated_at 
    FROM chat_sessions 
    WHERE user_id = ? 
    ORDER BY created_at DESC
""", (user_id,))
sessions = cursor.fetchall()
print(f"📁 Chat Sessions: {len(sessions)}")
for s in sessions:
    print(f"   ID: {s[0]}, Title: {s[1]}, Created: {s[2]}")

if sessions:
    # Check messages in most recent session
    session_id = sessions[0][0]
    cursor.execute("""
        SELECT id, user_message, ai_response, timestamp 
        FROM chat_messages 
        WHERE chat_session_id = ? 
        ORDER BY timestamp DESC
    """, (session_id,))
    messages = cursor.fetchall()
    print(f"\n💬 Messages in Session {session_id}: {len(messages)}")
    for m in messages:
        print(f"   ID: {m[0]}")
        print(f"   User: {m[1][:80]}...")
        print(f"   AI: {m[2][:80]}...")
        print(f"   Time: {m[3]}\n")

# Check gamification stats
cursor.execute("""
    SELECT total_ai_chats, weekly_ai_chats, total_points, level 
    FROM user_gamification_stats 
    WHERE user_id = ?
""", (user_id,))
stats = cursor.fetchone()
print(f"🎮 Gamification Stats:")
print(f"   Total AI Chats: {stats[0]}")
print(f"   Weekly AI Chats: {stats[1]}")
print(f"   Total Points: {stats[2]}")
print(f"   Level: {stats[3]}")

# Check point transactions
cursor.execute("""
    SELECT id, activity_type, points_earned, description, created_at 
    FROM point_transactions 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
""", (user_id,))
transactions = cursor.fetchall()
print(f"\n💰 Recent Point Transactions: {len(transactions)}")
for t in transactions:
    print(f"   {t[4]}: {t[1]} (+{t[2]} pts) - {t[3]}")

conn.close()
