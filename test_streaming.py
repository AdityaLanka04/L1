#!/usr/bin/env python3
"""
Test script for AI streaming endpoint
"""
import requests
import sys

API_URL = "http://localhost:8000"

def test_streaming():
    """Test the streaming endpoint"""
    print("🧪 Testing AI streaming endpoint...")
    
    # Get token (you'll need to replace with a valid token)
    token = input("Enter your auth token (or press Enter to skip): ").strip()
    if not token:
        print("⚠️  No token provided, using test credentials")
        # Try to login
        login_response = requests.post(
            f"{API_URL}/api/login",
            data={
                "username": "test@example.com",
                "password": "testpassword"
            }
        )
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            print(f"✅ Logged in successfully")
        else:
            print("❌ Login failed. Please provide a valid token.")
            return
    
    # Test streaming
    print("\n📡 Sending streaming request...")
    response = requests.post(
        f"{API_URL}/api/ask_stream/",
        data={
            "user_id": "test@example.com",
            "question": "Explain quantum computing in simple terms",
            "chat_id": "1"
        },
        headers={"Authorization": f"Bearer {token}"},
        stream=True
    )
    
    if response.status_code != 200:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
        return
    
    print("✅ Streaming started!\n")
    print("=" * 60)
    
    full_response = ""
    for line in response.iter_lines():
        if line:
            line_str = line.decode('utf-8')
            if line_str.startswith('data: '):
                try:
                    import json
                    data = json.loads(line_str[6:])
                    
                    if 'chunk' in data:
                        chunk = data['chunk']
                        full_response += chunk
                        print(chunk, end='', flush=True)
                    
                    if 'done' in data and data['done']:
                        print("\n" + "=" * 60)
                        print(f"\n✅ Streaming complete! Total length: {len(full_response)} chars")
                        break
                    
                    if 'error' in data:
                        print(f"\n❌ Error: {data['error']}")
                        break
                        
                except json.JSONDecodeError as e:
                    print(f"\n⚠️  JSON decode error: {e}")
                    continue

if __name__ == "__main__":
    test_streaming()
