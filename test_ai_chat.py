import requests

API_URL = "http://localhost:8000/api"

# Test the /ask endpoint
print("Testing AI Chat endpoint...")
print("="*60)

# Use a real user from the database
user_id = "asphar057@gmail.com"
question = "What is Python?"
chat_id = "14"  # Valid chat for this user

data = {
    "user_id": user_id,
    "question": question,
    "chat_id": chat_id
}

try:
    response = requests.post(f"{API_URL}/ask/", data=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        result = response.json()
        print("\n✅ SUCCESS!")
        print(f"Answer: {result.get('answer', 'No answer')[:200]}...")
        print(f"AI Provider: {result.get('ai_provider', 'Unknown')}")
        print(f"Model: {result.get('model_used', 'Unknown')}")
    else:
        print(f"\n❌ ERROR: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"\n❌ EXCEPTION: {e}")
    import traceback
    traceback.print_exc()
