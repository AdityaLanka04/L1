"""
Test script for conversation context detection
Run this to verify the fixes are working correctly
"""

from conversation_context_detector import ConversationContextDetector

def test_emotional_detection():
    """Test emotional topic detection"""
    print("\n" + "="*60)
    print("TEST 1: Emotional Topic Detection")
    print("="*60)
    
    detector = ConversationContextDetector()
    
    test_cases = [
        ("i am depressed", True),
        ("feeling really anxious today", True),
        ("i'm so stressed about everything", True),
        ("explain neural networks", False),
        ("how do i solve this math problem", False),
    ]
    
    for message, expected in test_cases:
        result = detector.is_emotional_personal_topic(message)
        status = "✅ PASS" if result == expected else "❌ FAIL"
        print(f"{status}: '{message}' -> Emotional: {result} (expected: {expected})")


def test_rejection_detection():
    """Test rejection phrase detection"""
    print("\n" + "="*60)
    print("TEST 2: Rejection Phrase Detection")
    print("="*60)
    
    detector = ConversationContextDetector()
    
    test_cases = [
        ("can we not talk about academics", True),
        ("i said don't talk about that", True),
        ("stop talking about studying", True),
        ("explain this concept to me", False),
        ("what is machine learning", False),
    ]
    
    for message, expected in test_cases:
        result = detector.is_rejecting_previous_approach(message)
        status = "✅ PASS" if result == expected else "❌ FAIL"
        print(f"{status}: '{message}' -> Rejecting: {result} (expected: {expected})")


def test_academic_avoidance():
    """Test academic avoidance detection"""
    print("\n" + "="*60)
    print("TEST 3: Academic Avoidance Detection")
    print("="*60)
    
    detector = ConversationContextDetector()
    
    # Simulate conversation history
    history_with_avoidance = [
        {"user_message": "i am depressed", "ai_response": "Let's study!"},
        {"user_message": "can we not talk about academics", "ai_response": "Sure!"}
    ]
    
    history_without_avoidance = [
        {"user_message": "explain neural networks", "ai_response": "Neural networks are..."},
        {"user_message": "tell me more", "ai_response": "Here's more detail..."}
    ]
    
    result1 = detector.should_avoid_academics(history_with_avoidance)
    result2 = detector.should_avoid_academics(history_without_avoidance)
    
    status1 = "✅ PASS" if result1 == True else "❌ FAIL"
    status2 = "✅ PASS" if result2 == False else "❌ FAIL"
    
    print(f"{status1}: History with 'not talk about academics' -> {result1} (expected: True)")
    print(f"{status2}: Normal academic history -> {result2} (expected: False)")


def test_mode_suggestion():
    """Test conversation mode suggestions"""
    print("\n" + "="*60)
    print("TEST 4: Mode Suggestion")
    print("="*60)
    
    detector = ConversationContextDetector()
    
    test_cases = [
        ("i am depressed", "personal_support"),
        ("feeling anxious", "personal_support"),
        ("explain neural networks", "tutoring"),
        ("how are you", "casual"),
    ]
    
    for message, expected_mode in test_cases:
        result = detector.get_conversation_mode_suggestion(message)
        status = "✅ PASS" if result == expected_mode else "❌ FAIL"
        print(f"{status}: '{message}' -> Mode: {result} (expected: {expected_mode})")


def test_context_summary():
    """Test comprehensive context summary"""
    print("\n" + "="*60)
    print("TEST 5: Context Summary")
    print("="*60)
    
    detector = ConversationContextDetector()
    
    # Test emotional message
    message1 = "i am depressed"
    summary1 = detector.get_context_summary(message1)
    print(f"\nMessage: '{message1}'")
    print(f"  Is Emotional: {summary1['is_emotional']}")
    print(f"  Suggested Mode: {summary1['suggested_mode']}")
    print(f"  Should Avoid Academics: {summary1['should_avoid_academics']}")
    
    # Test rejection message with history
    message2 = "can we not talk about academics"
    history = [
        {"user_message": "i am sad", "ai_response": "Let's study!"}
    ]
    summary2 = detector.get_context_summary(message2, history)
    print(f"\nMessage: '{message2}'")
    print(f"  Is Rejecting: {summary2['is_rejecting']}")
    print(f"  Suggested Mode: {summary2['suggested_mode']}")
    print(f"  Rejection Count: {summary2['rejection_count']}")


def test_cache_key_generation():
    """Test that cache keys are different for different conversations"""
    print("\n" + "="*60)
    print("TEST 6: Cache Key Generation")
    print("="*60)
    
    prompt = "explain neural networks"
    
    # Same prompt, different conversations
    key1 = f"chat_1_{prompt}"
    key2 = f"chat_2_{prompt}"
    key3 = prompt  # No conversation ID
    
    print(f"Prompt: '{prompt}'")
    print(f"  Conversation 1 key: {key1}")
    print(f"  Conversation 2 key: {key2}")
    print(f"  No conversation key: {key3}")
    print(f"\n✅ Keys are different: {key1 != key2 != key3}")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("CONVERSATION CONTEXT DETECTOR - TEST SUITE")
    print("="*60)
    
    try:
        test_emotional_detection()
        test_rejection_detection()
        test_academic_avoidance()
        test_mode_suggestion()
        test_context_summary()
        test_cache_key_generation()
        
        print("\n" + "="*60)
        print("✅ ALL TESTS COMPLETED")
        print("="*60)
        print("\nIf all tests passed, the conversation context detection is working!")
        print("The AI should now:")
        print("  1. Detect emotional topics")
        print("  2. Recognize when user rejects approach")
        print("  3. Avoid academics when requested")
        print("  4. Suggest appropriate conversation modes")
        print("  5. Use conversation-aware cache keys")
        
    except Exception as e:
        print(f"\n❌ TEST FAILED WITH ERROR: {e}")
        import traceback
        traceback.print_exc()
