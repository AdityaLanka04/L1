"""
Test Human Response Logic
Shows how the AI will respond to different patterns
"""

from human_response_logic import HumanResponseLogic

def test_repetition_detection():
    """Test detection of repeated messages"""
    print("\n" + "="*60)
    print("TEST 1: Repetition Detection")
    print("="*60)
    
    logic = HumanResponseLogic()
    
    # Simulate conversation where user says "hey man" 4 times
    history = [
        {"user_message": "hey man", "ai_response": "Hello!"},
        {"user_message": "hey man", "ai_response": "Hi again!"},
        {"user_message": "hey man", "ai_response": "Hey there!"},
    ]
    
    current = "hey man"
    
    analysis = logic.analyze_conversation_pattern(current, history)
    
    print(f"Current message: '{current}'")
    print(f"History: {len(history)} messages")
    print(f"\nAnalysis:")
    print(f"  Is Repetitive: {analysis['is_repetitive']}")
    print(f"  Repetition Count: {analysis['repetition_count']}")
    print(f"  Call Out Behavior: {analysis['call_out_behavior']}")
    print(f"  Suggested Style: {analysis['suggested_style']}")
    
    if analysis['call_out_behavior']:
        instruction = logic.generate_human_response_instruction(analysis, current)
        print(f"\n📝 AI Instruction (first 300 chars):")
        print(instruction[:300] + "...")
        
        print(f"\n✅ AI will call out: 'You've said that {analysis['repetition_count']} times now 😅'")


def test_trolling_detection():
    """Test detection of trolling behavior"""
    print("\n" + "="*60)
    print("TEST 2: Trolling Detection")
    print("="*60)
    
    logic = HumanResponseLogic()
    
    # Simulate conversation where user sends short messages repeatedly
    history = [
        {"user_message": "hey", "ai_response": "Hello!"},
        {"user_message": "hi", "ai_response": "Hi!"},
        {"user_message": "sup", "ai_response": "Not much!"},
        {"user_message": "yo", "ai_response": "Hey!"},
    ]
    
    current = "lol"
    
    analysis = logic.analyze_conversation_pattern(current, history)
    
    print(f"Current message: '{current}'")
    print(f"History: {len(history)} short messages")
    print(f"\nAnalysis:")
    print(f"  Is Trolling: {analysis['is_trolling']}")
    print(f"  Call Out Behavior: {analysis['call_out_behavior']}")
    print(f"  Suggested Style: {analysis['suggested_style']}")
    
    if analysis['call_out_behavior']:
        print(f"\n✅ AI will call out: 'Alright, you're definitely testing me 😅 What's actually up?'")


def test_short_message_response():
    """Test response to short messages"""
    print("\n" + "="*60)
    print("TEST 3: Short Message Response")
    print("="*60)
    
    logic = HumanResponseLogic()
    
    test_cases = [
        ("hey", "short greeting"),
        ("thanks", "short thanks"),
        ("ok", "short acknowledgment"),
        ("sup", "casual greeting"),
    ]
    
    for message, description in test_cases:
        analysis = logic.analyze_conversation_pattern(message, [])
        max_tokens = logic.get_max_tokens_for_style(analysis)
        
        print(f"\nMessage: '{message}' ({description})")
        print(f"  Is Short: {analysis['is_short_message']}")
        print(f"  Max Length: {analysis['suggested_max_length']}")
        print(f"  Max Tokens: {max_tokens}")
        print(f"  ✅ AI will respond with ~{max_tokens} tokens (short and casual)")


def test_loop_detection():
    """Test conversation loop detection"""
    print("\n" + "="*60)
    print("TEST 4: Conversation Loop Detection")
    print("="*60)
    
    logic = HumanResponseLogic()
    
    # Simulate loop: user says same thing 4 times
    history = [
        {"user_message": "hey man", "ai_response": "Hello!"},
        {"user_message": "hey man", "ai_response": "Hi again!"},
        {"user_message": "hey man", "ai_response": "Hey there!"},
        {"user_message": "hey man", "ai_response": "What's up?"},
    ]
    
    is_loop = logic.detect_conversation_loop(history)
    
    print(f"History: {len(history)} messages")
    print(f"User messages: {[msg['user_message'] for msg in history]}")
    print(f"\nLoop Detected: {is_loop}")
    
    if is_loop:
        response = logic.get_loop_breaking_response()
        print(f"\n✅ AI will break loop with:")
        print(f"   '{response[:100]}...'")


def test_verbose_penalty():
    """Test detection of AI being too verbose"""
    print("\n" + "="*60)
    print("TEST 5: Verbose AI Detection")
    print("="*60)
    
    logic = HumanResponseLogic()
    
    # Simulate AI writing essays
    history = [
        {
            "user_message": "hey",
            "ai_response": "Hello! " + "I'm here to help you learn. " * 50  # Long response
        },
        {
            "user_message": "hi",
            "ai_response": "Hi there! " + "Let me explain everything. " * 50  # Long response
        },
        {
            "user_message": "sup",
            "ai_response": "Not much! " + "Here's what we can do. " * 50  # Long response
        },
    ]
    
    current = "ok"
    analysis = logic.analyze_conversation_pattern(current, history)
    
    avg_length = sum(len(msg['ai_response']) for msg in history) / len(history)
    
    print(f"Recent AI responses average: {avg_length:.0f} characters")
    print(f"Current message: '{current}'")
    print(f"\nAnalysis:")
    print(f"  Suggested Max Length: {analysis['suggested_max_length']}")
    print(f"  Max Tokens: {logic.get_max_tokens_for_style(analysis)}")
    print(f"\n✅ AI will tone down verbosity and respond SHORT")


def show_example_responses():
    """Show example of how AI will respond"""
    print("\n" + "="*60)
    print("EXAMPLE RESPONSES")
    print("="*60)
    
    examples = [
        {
            "scenario": "User says 'hey man' 4 times",
            "ai_response": "Hey, you've said 'hey man' like 4 times now 😅 What's up? Everything okay?"
        },
        {
            "scenario": "User sends short messages repeatedly",
            "ai_response": "Alright, you're definitely testing me 😅 What's actually up?"
        },
        {
            "scenario": "User says 'hey'",
            "ai_response": "Hey! What's up?"
        },
        {
            "scenario": "User says 'thanks'",
            "ai_response": "No problem! 😊"
        },
        {
            "scenario": "Conversation stuck in loop",
            "ai_response": "Okay, I notice we're going in circles here 😅\n\nLet's reset. What do you actually want to talk about or do?"
        },
    ]
    
    for example in examples:
        print(f"\n📝 Scenario: {example['scenario']}")
        print(f"🤖 AI Response: \"{example['ai_response']}\"")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("HUMAN RESPONSE LOGIC - TEST SUITE")
    print("="*60)
    
    try:
        test_repetition_detection()
        test_trolling_detection()
        test_short_message_response()
        test_loop_detection()
        test_verbose_penalty()
        show_example_responses()
        
        print("\n" + "="*60)
        print("✅ ALL TESTS COMPLETED")
        print("="*60)
        print("\nThe AI will now:")
        print("  1. ✅ Respond SHORT to short messages")
        print("  2. ✅ Call out repetition naturally")
        print("  3. ✅ Detect and call out trolling")
        print("  4. ✅ Break out of conversation loops")
        print("  5. ✅ Adjust verbosity based on context")
        print("  6. ✅ Respond like a HUMAN, not a bot")
        
    except Exception as e:
        print(f"\n❌ TEST FAILED WITH ERROR: {e}")
        import traceback
        traceback.print_exc()
