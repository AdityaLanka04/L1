"""Quick test for login notification"""
import requests

API_URL = "http://localhost:8000/api"

# Test login notification
username = "anirudh"  # Replace with your username
token = "your_token_here"  # Replace with actual token

response = requests.get(
    f"{API_URL}/check_proactive_message",
    params={"user_id": username, "is_login": "true"},
    headers={"Authorization": f"Bearer {token}"}
)

print("Status:", response.status_code)
print("Response:", response.json())

if response.json().get("should_notify"):
    print("\n✅ NOTIFICATION WILL SHOW!")
    print("Message:", response.json().get("message"))
else:
    print("\n❌ NO NOTIFICATION")
