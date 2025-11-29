import requests

response = requests.post(
    "http://localhost:8000/api/test_ai_simple",
    data={"question": "What is 2+2?"},
    timeout=15
)

print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
