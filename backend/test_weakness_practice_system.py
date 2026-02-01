"""
Test script for Comprehensive Weakness Practice System
Run: python test_weakness_practice_system.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import asyncio
from database import SessionLocal
import models
from comprehensive_weakness_practice_system import create_weakness_practice_system
from ai_utils import UnifiedAIClient
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_system():
    """Test the weakness practice system"""
    
    print("\n" + "="*60)
    print("TESTING COMPREHENSIVE WEAKNESS PRACTICE SYSTEM")
    print("="*60 + "\n")
    
    # Initialize
    db = SessionLocal()
    
    try:
        # Initialize AI client (mock for testing)
        class MockAIClient:
            def generate(self, prompt, max_tokens=2000, temperature=0.7):
                return '''[
                    {
                        "question": "What is the time complexity of Dijkstra's Algorithm?",
                        "type": "multiple_choice",
                        "options": ["O(n)", "O(n log n)", "O(n^2)", "O(E + V log V)"],
                        "correct_answer": "O(E + V log V)",
                        "explanation": "Dijkstra's algorithm with a binary heap has O(E + V log V) complexity.",
                        "difficulty": "intermediate",
                        "topic": "Dijkstra's Algorithm",
                        "hints": ["Consider the heap operations", "Think about edge relaxation"]
                    }
                ]'''
        
        ai_client = MockAIClient()
        
        # Create system
        system = create_weakness_practice_system(db, models, ai_client, kg_client=None)
        
        # Test 1: Get weakness analysis
        print("TEST 1: Weakness Analysis")
        print("-" * 60)
        
        # Get first user
        user = db.query(models.User).first()
        if not user:
            print("❌ No users found in database")
            return
        
        print(f"Testing with user: {user.username} (ID: {user.id})")
        
        analysis = await system.get_comprehensive_analysis(user.id)
        
        if analysis.get("status") == "success":
            print(f"✅ Analysis successful")
            print(f"   Total weaknesses: {analysis['summary']['total_weaknesses']}")
            print(f"   Critical: {analysis['summary']['critical_count']}")
            print(f"   High priority: {analysis['summary']['high_priority_count']}")
        else:
            print(f"❌ Analysis failed: {analysis.get('error')}")
        
        print()
        
        # Test 2: Start practice session
        print("TEST 2: Practice Session")
        print("-" * 60)
        
        session_result = await system.start_practice_session(
            user_id=user.id,
            topic="Dijkstra's Algorithm",
            difficulty="intermediate",
            question_count=5
        )
        
        if session_result.get("status") == "success":
            print(f"✅ Session started")
            print(f"   Session ID: {session_result['session_id']}")
            print(f"   Topic: {session_result['topic']}")
            session_id = session_result['session_id']
        else:
            print(f"❌ Session start failed: {session_result.get('error')}")
            return
        
        print()
        
        # Test 3: Get next question
        print("TEST 3: Get Next Question")
        print("-" * 60)
        
        question_result = await system.get_next_question(session_id)
        
        if question_result.get("status") == "success":
            print(f"✅ Question retrieved")
            print(f"   Question: {question_result['question']['question'][:80]}...")
            print(f"   Type: {question_result['question']['type']}")
        else:
            print(f"❌ Question retrieval failed: {question_result.get('error')}")
            return
        
        print()
        
        # Test 4: Submit answer
        print("TEST 4: Submit Answer")
        print("-" * 60)
        
        answer_result = system.submit_answer(
            session_id=session_id,
            question_id="test_q1",
            user_answer="O(E + V log V)",
            time_taken=30
        )
        
        if answer_result.get("status") == "success":
            print(f"✅ Answer submitted")
            print(f"   Correct: {answer_result['is_correct']}")
            print(f"   Accuracy: {answer_result['accuracy']:.1f}%")
            print(f"   Streak: {answer_result['current_streak']}")
        else:
            print(f"❌ Answer submission failed: {answer_result.get('error')}")
        
        print()
        
        # Test 5: End session
        print("TEST 5: End Session")
        print("-" * 60)
        
        summary = system.end_practice_session(session_id)
        
        if summary.get("status") == "success":
            print(f"✅ Session ended")
            print(f"   Questions answered: {summary['statistics']['total_questions']}")
            print(f"   Accuracy: {summary['statistics']['accuracy']}%")
            print(f"   Performance: {summary['performance_level']}")
        else:
            print(f"❌ Session end failed: {summary.get('error')}")
        
        print()
        
        # Test 6: Mastery overview
        print("TEST 6: Mastery Overview")
        print("-" * 60)
        
        mastery = system.get_mastery_overview(user.id)
        
        print(f"✅ Mastery overview retrieved")
        print(f"   Total topics: {mastery['total_topics']}")
        print(f"   Expert topics: {mastery['expert_topics']}")
        print(f"   Average mastery: {mastery['avg_mastery']:.2f}")
        
        print()
        
        # Test 7: Weekly progress
        print("TEST 7: Weekly Progress")
        print("-" * 60)
        
        progress = system.get_weekly_progress(user.id)
        
        if progress.get("has_data"):
            print(f"✅ Progress data available")
            print(f"   Total sessions: {progress['summary']['total_sessions']}")
            print(f"   Overall accuracy: {progress['summary']['overall_accuracy']}%")
        else:
            print(f"ℹ️  No progress data yet: {progress.get('message')}")
        
        print()
        
        print("="*60)
        print("ALL TESTS COMPLETED SUCCESSFULLY! ✅")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_system())
