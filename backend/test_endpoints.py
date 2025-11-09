"""
Quick test to verify gamification endpoints are working
"""
import requests
import json

API_URL = "http://localhost:8000/api"

# Replace with your actual token and username
TOKEN = "your_token_here"
USERNAME = "your_username_here"

headers = {
    "Authorization": f"Bearer {TOKEN}"
}

print("=" * 60)
print("TESTING GAMIFICATION ENDPOINTS")
print("=" * 60)

# Test 1: Get gamification stats
print("\n[1] Testing get_gamification_stats...")
response = requests.get(
    f"{API_URL}/get_gamification_stats?user_id={USERNAME}",
    headers=headers
)
print(f"Status: {response.status_code}")
if response.ok:
    data = response.json()
    print(f"✅ Total Points: {data.get('total_points')}")
    print(f"✅ Level: {data.get('level')}")
    print(f"✅ Weekly Points: {data.get('weekly_points')}")
else:
    print(f"❌ Error: {response.text}")

# Test 2: Get weekly bingo stats
print("\n[2] Testing get_weekly_bingo_stats...")
response = requests.get(
    f"{API_URL}/get_weekly_bingo_stats?user_id={USERNAME}",
    headers=headers
)
print(f"Status: {response.status_code}")
if response.ok:
    data = response.json()
    print(f"✅ Stats: {json.dumps(data.get('stats'), indent=2)}")
else:
    print(f"❌ Error: {response.text}")

# Test 3: Get weekly activity progress
print("\n[3] Testing get_weekly_activity_progress...")
response = requests.get(
    f"{API_URL}/get_weekly_activity_progress?user_id={USERNAME}",
    headers=headers
)
print(f"Status: {response.status_code}")
if response.ok:
    data = response.json()
    print(f"✅ AI Chats: {data.get('ai_chats')}")
    print(f"✅ Notes: {data.get('notes_created')}")
    print(f"✅ Questions: {data.get('questions_answered')}")
    print(f"✅ Quizzes: {data.get('quizzes_completed')}")
    print(f"✅ Flashcards: {data.get('flashcards_created')}")
else:
    print(f"❌ Error: {response.text}")

# Test 4: Get recent activities
print("\n[4] Testing get_recent_point_activities...")
response = requests.get(
    f"{API_URL}/get_recent_point_activities?user_id={USERNAME}&limit=5",
    headers=headers
)
print(f"Status: {response.status_code}")
if response.ok:
    data = response.json()
    activities = data.get('activities', [])
    print(f"✅ Recent Activities: {len(activities)}")
    for activity in activities:
        print(f"   - {activity.get('description')}: +{activity.get('points')} pts")
else:
    print(f"❌ Error: {response.text}")

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)
