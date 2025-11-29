import requests
import json

API_URL = "http://localhost:8000/api"

# Test with the user that has activities
test_users = [
    "stupendous0512@gmail.com",
    "asphar057@gmail.com"
]

for user_id in test_users:
    print(f"\n{'='*60}")
    print(f"Testing user: {user_id}")
    print('='*60)
    
    # Test heatmap
    print("\n1. Testing activity heatmap...")
    response = requests.get(f"{API_URL}/get_activity_heatmap", params={"user_id": user_id})
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Total count: {data.get('total_count', 0)}")
        print(f"   ✅ Heatmap data points: {len(data.get('heatmap_data', []))}")
        # Show some non-zero days
        non_zero = [d for d in data.get('heatmap_data', []) if d['count'] > 0]
        print(f"   ✅ Days with activity: {len(non_zero)}")
        if non_zero:
            print(f"   Sample: {non_zero[:3]}")
    else:
        print(f"   ❌ Error: {response.status_code} - {response.text}")
    
    # Test notifications
    print("\n2. Testing notifications...")
    response = requests.get(f"{API_URL}/get_notifications", params={"user_id": user_id})
    if response.status_code == 200:
        data = response.json()
        notifications = data.get('notifications', [])
        print(f"   ✅ Notifications: {len(notifications)}")
        if notifications:
            for notif in notifications[:3]:
                print(f"      - {notif['title']}: {notif['message'][:50]}...")
    else:
        print(f"   ❌ Error: {response.status_code} - {response.text}")
    
    # Test proactive message (login)
    print("\n3. Testing proactive message (login)...")
    response = requests.get(
        f"{API_URL}/check_proactive_message",
        params={"user_id": user_id, "is_login": "true"}
    )
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Should notify: {data.get('should_notify', False)}")
        if data.get('should_notify'):
            print(f"   ✅ Message: {data.get('message', '')[:100]}...")
            print(f"   ✅ Chat ID: {data.get('chat_id')}")
    else:
        print(f"   ❌ Error: {response.status_code} - {response.text}")

print("\n" + "="*60)
print("Testing complete!")
print("="*60)
