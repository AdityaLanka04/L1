"""
Test ML-based Proactive Notification System
Run this to verify the ML notification system is working correctly
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from datetime import datetime, timezone, timedelta
from backend.database import SessionLocal
from backend.proactive_ai_system import get_proactive_ai_engine
from backend.ai_utils import UnifiedAIClient
import backend.models as models

def test_ml_notification_system():
    """Test the ML-based notification system"""
    
    print("🧪 Testing ML-Based Proactive Notification System\n")
    print("=" * 60)
    
    # Initialize
    db = SessionLocal()
    
    try:
        # Get a test user
        user = db.query(models.User).first()
        if not user:
            print("❌ No users found in database. Please create a user first.")
            return
        
        print(f"✅ Testing with user: {user.username} (ID: {user.id})")
        print(f"   Name: {user.first_name} {user.last_name}")
        print(f"   Field: {user.field_of_study or 'Not set'}\n")
        
        # Initialize AI client
        from dotenv import load_dotenv
        load_dotenv()
        
        GEMINI_API_KEY = os.getenv("GOOGLE_GENERATIVE_AI_KEY") or os.getenv("GEMINI_API_KEY")
        GROQ_API_KEY = os.getenv("GROQ_API_KEY")
        
        if not GEMINI_API_KEY and not GROQ_API_KEY:
            print("❌ No AI API keys found. Please set GEMINI_API_KEY or GROQ_API_KEY")
            return
        
        # Initialize clients
        gemini_client = None
        groq_client = None
        
        if GEMINI_API_KEY:
            import google.generativeai as genai
            genai.configure(api_key=GEMINI_API_KEY)
            gemini_client = genai
            print("✅ Gemini API initialized")
        
        if GROQ_API_KEY:
            from groq import Groq
            groq_client = Groq(api_key=GROQ_API_KEY)
            print("✅ Groq API initialized")
        
        unified_ai = UnifiedAIClient(
            gemini_client, 
            groq_client, 
            "gemini-2.0-flash", 
            "llama-3.3-70b-versatile"
        )
        
        # Get proactive engine
        engine = get_proactive_ai_engine(unified_ai)
        print("✅ Proactive AI engine initialized\n")
        
        # Test 1: Analyze learning patterns
        print("📊 Test 1: Analyzing Learning Patterns")
        print("-" * 60)
        patterns = engine.analyze_learning_patterns(db, user.id, is_idle=False)
        print(f"   Wrong answers: {patterns['wrong_answers_count']}")
        print(f"   Struggling topics: {patterns['struggling_topics']}")
        print(f"   Weak topics: {len(patterns.get('weak_topics', []))}")
        print(f"   Is new user: {patterns['is_new_user']}")
        print(f"   Just completed quiz: {patterns['just_completed_quiz']}\n")
        
        # Test 2: Calculate ML score
        print("🤖 Test 2: ML Intervention Score")
        print("-" * 60)
        user_history = engine._get_user_history(db, user.id)
        score = engine.calculate_ml_intervention_score(patterns, user_history)
        print(f"   ML Score: {score:.3f} (0-1 scale)")
        print(f"   User accuracy: {user_history['accuracy']:.1%}")
        print(f"   Avg daily activities: {user_history['avg_daily_activities']:.1f}")
        print(f"   Notification response rate: {user_history.get('notification_response_rate', 0.5):.1%}\n")
        
        # Test 3: Should reach out decision
        print("🎯 Test 3: ML Decision Making")
        print("-" * 60)
        should_reach, reason, urgency = engine.should_reach_out(patterns, user_history)
        print(f"   Should reach out: {should_reach}")
        print(f"   Reason: {reason}")
        print(f"   Urgency score: {urgency:.3f}\n")
        
        # Test 4: Generate message (if should reach out)
        if should_reach:
            print("💬 Test 4: AI Message Generation")
            print("-" * 60)
            user_profile = {
                "first_name": user.first_name or "there",
                "field_of_study": user.field_of_study or "General Studies"
            }
            
            import asyncio
            message = asyncio.run(
                engine.generate_proactive_message(db, user.id, reason, user_profile)
            )
            print(f"   Generated message:\n   '{message}'\n")
        
        # Test 5: Full check
        print("🔔 Test 5: Full Notification Check")
        print("-" * 60)
        user_profile = {
            "first_name": user.first_name or "there",
            "field_of_study": user.field_of_study or "General Studies"
        }
        
        import asyncio
        result = asyncio.run(
            engine.check_and_send_proactive_message(db, user.id, user_profile, is_idle=False)
        )
        
        if result:
            print(f"   ✅ Notification should be sent!")
            print(f"   Message: '{result['message']}'")
            print(f"   Reason: {result['reason']}")
            print(f"   Urgency: {result['urgency_score']:.3f}")
            print(f"   Optimal delay: {result['optimal_delay_minutes']} minutes")
        else:
            print(f"   ℹ️  No notification needed at this time")
        
        print("\n" + "=" * 60)
        print("✅ All tests completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        db.close()

if __name__ == "__main__":
    test_ml_notification_system()
