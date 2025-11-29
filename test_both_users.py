import requests

API_URL = "http://localhost:8000/api"

users = [
    ("stupendous0512@gmail.com", "27"),
    ("asphar057@gmail.com", "14")
]

for user_email, chat_id in users:
    print(f"\n{'='*60}")
    print(f"Testing: {user_email} with chat {chat_id}")
    print('='*60)
    
    data = {
        "user_id": user_email,
        "question": "Hello, test message",
        "chat_id": chat_id
    }
    
    try:
        response = requests.post(f"{API_URL}/ask/", data=data, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            answer = result.get('answer', '')
            if 'error' in answer.lower() or 'apologize' in answer.lower():
                print(f"❌ Got error response: {answer[:100]}")
            else:
                print(f"✅ SUCCESS: {answer[:100]}...")
        else:
            print(f"❌ HTTP Error: {response.text[:200]}")
    except Exception as e:
        print(f"❌ Exception: {e}")
