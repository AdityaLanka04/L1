import sqlite3

conn = sqlite3.connect('backend/brainwave_tutor.db')
cursor = conn.cursor()

cursor.execute('SELECT id, user_message, ai_response FROM chat_messages WHERE chat_session_id = 29 ORDER BY id DESC LIMIT 5')
print('Recent messages in chat 29:')
for row in cursor.fetchall():
    msg_id, user_msg, ai_resp = row
    print(f'\nMessage {msg_id}:')
    print(f'  User: {user_msg[:50] if user_msg else "None"}')
    print(f'  AI: {ai_resp[:50] if ai_resp else "None"}')

conn.close()
