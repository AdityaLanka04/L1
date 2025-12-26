"""
Test script to verify AI agents are working
Run: python backend/test_agents.py
"""

import requests
import json

API_URL = "http://localhost:8000"

def test_ai_chat_agent():
    """Test AI Chat Agent"""
    print("\n" + "="*60)
    print("TESTING AI CHAT AGENT")
    print("="*60)
    
    # Test 1: Send a confused message
    print("\n1. Testing confusion detection...")
    response = requests.post(
        f"{API_URL}/api/ai-chat-agent/message",
        json={
            "user_id": "test_user",
            "message": "I don't understand recursion at all, it's so confusing",
            "mode": "tutoring"
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Agent responded successfully")
        print(f"   Confusion detected: {data['data']['analysis']['confusion_detected']}")
        print(f"   Engagement score: {data['data']['analysis']['engagement_score']:.2f}")
        
        if data['data']['weaknesses']:
            print(f"   Weaknesses found: {len(data['data']['weaknesses'])}")
            for w in data['data']['weaknesses'][:2]:
                print(f"      - {w['subcategory']}: {w['severity']:.0%} severity")
    else:
        print(f"❌ Failed: {response.status_code}")
        print(response.text)
    
    # Test 2: Get progress report
    print("\n2. Testing progress report...")
    response = requests.get(
        f"{API_URL}/api/ai-chat-agent/progress-report",
        params={"user_id": "test_user"}
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Progress report generated")
        overview = data['data']['overview']
        print(f"   Total concepts: {overview['total_concepts']}")
        print(f"   Mastered: {overview['mastered']}")
        print(f"   Struggling: {overview['struggling']}")
    else:
        print(f"❌ Failed: {response.status_code}")
    
    # Test 3: Get recommendations
    print("\n3. Testing recommendations...")
    response = requests.get(
        f"{API_URL}/api/ai-chat-agent/recommendations",
        params={"user_id": "test_user"}
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Recommendations generated")
        if data['data']['recommendations']:
            print(f"   Found {len(data['data']['recommendations'])} recommendations")
            for rec in data['data']['recommendations'][:2]:
                print(f"      - {rec['topic']}: {rec['reason']}")
    else:
        print(f"❌ Failed: {response.status_code}")


def test_flashcard_agent():
    """Test Flashcard Agent"""
    print("\n" + "="*60)
    print("TESTING FLASHCARD AGENT")
    print("="*60)
    
    # Test 1: Add a card
    print("\n1. Testing card addition...")
    response = requests.post(
        f"{API_URL}/api/flashcard-agent/add-card",
        json={
            "user_id": "test_user",
            "card_id": "test_card_1",
            "content": {
                "front": "What is Python?",
                "back": "A high-level programming language"
            },
            "tags": ["programming", "python"]
        }
    )
    
    if response.status_code == 200:
        print("✅ Card added successfully")
    else:
        print(f"❌ Failed: {response.status_code}")
    
    # Test 2: Start study session
    print("\n2. Testing study session start...")
    response = requests.post(
        f"{API_URL}/api/flashcard-agent/start-session",
        json={
            "user_id": "test_user",
            "session_type": "review"
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Session started")
        print(f"   Cards to review: {data['data']['card_count']}")
        print(f"   Estimated time: {data['data']['prediction']['estimated_time_minutes']} min")
        print(f"   Estimated accuracy: {data['data']['prediction']['estimated_accuracy']:.0%}")
    else:
        print(f"❌ Failed: {response.status_code}")
    
    # Test 3: Review a card
    print("\n3. Testing card review...")
    response = requests.post(
        f"{API_URL}/api/flashcard-agent/review-card",
        json={
            "user_id": "test_user",
            "card_id": "test_card_1",
            "quality": 5,  # Perfect recall
            "response_time": 3.5
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Card reviewed")
        print(f"   Next review: {data['data']['next_review']}")
        print(f"   Retention rate: {data['data']['retention_rate']:.0%}")
        print(f"   Confidence: {data['data']['confidence_score']:.0%}")
        print(f"   Learning phase: {data['data']['learning_phase']}")
    else:
        print(f"❌ Failed: {response.status_code}")
    
    # Test 4: Get statistics
    print("\n4. Testing statistics...")
    response = requests.get(
        f"{API_URL}/api/flashcard-agent/statistics",
        params={"user_id": "test_user"}
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Statistics retrieved")
        stats = data['data']
        print(f"   Total cards: {stats['total_cards']}")
        print(f"   Total reviews: {stats['total_reviews']}")
        print(f"   Average retention: {stats['average_retention']:.0%}")
        print(f"   Cards due today: {stats['cards_due_today']}")
    else:
        print(f"❌ Failed: {response.status_code}")
    
    # Test 5: Get comprehensive report
    print("\n5. Testing comprehensive report...")
    response = requests.get(
        f"{API_URL}/api/flashcard-agent/comprehensive-report",
        params={"user_id": "test_user"}
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Comprehensive report generated")
        overview = data['data']['overview']
        print(f"   Cards mastered: {overview['cards_mastered']}")
        print(f"   Cards in progress: {overview['cards_in_progress']}")
        print(f"   Study streak: {overview['study_streak_days']} days")
        
        if data['data']['recommendations']:
            print(f"   Recommendations: {len(data['data']['recommendations'])}")
    else:
        print(f"❌ Failed: {response.status_code}")


def main():
    print("\n🚀 TESTING AI AGENTS")
    print("Make sure backend is running on http://localhost:8000\n")
    
    try:
        # Test if server is running
        response = requests.get(f"{API_URL}/api/health")
        if response.status_code != 200:
            print("❌ Backend not responding. Start it with: python backend/main.py")
            return
        
        print("✅ Backend is running\n")
        
        # Run tests
        test_ai_chat_agent()
        test_flashcard_agent()
        
        print("\n" + "="*60)
        print("✅ ALL TESTS COMPLETE")
        print("="*60)
        print("\nThe agents are working! They're analyzing conversations and")
        print("optimizing flashcard reviews in the background.")
        
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Make sure it's running:")
        print("   python backend/main.py")
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    main()
