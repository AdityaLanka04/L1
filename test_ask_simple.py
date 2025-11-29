import requests

API_URL = "http://localhost:8000/api"

data = {
    "user_id": "stupendous0512@gmail.com",
    "question": "What is Python?",
    "chat_id": "27"
}

print("Testing /ask_simple endpoint...")
response = requests.post(f"{API_URL}/ask_simple/", data=data, timeout=30)
print(f"Status: {response.status_code}")
result = response.json()
print(f"Answer: {result.get('answer', '')[:200]}...")
print(f"Provider: {result.get('ai_provider')}")
print(f"Query Type: {result.get('query_type')}")
