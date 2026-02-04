#!/usr/bin/env python3
"""
Test the double brace fix for AI responses
"""
import json

def test_double_brace_conversion():
    """Test that we can detect and fix double braces from AI responses"""
    
    # Simulate what the AI might return if it copies our f-string template
    ai_response_with_double_braces = """{{"title": "Learning cloud computing","description": "Master cloud","estimated_hours": 40.0,"nodes": [{{"order_index": 0,"title": "Intro to cloud","description": "Basics","objectives": ["Learn cloud", "Understand types", "Master services"],"prerequisites": [],"resources": [{{"type": "article", "title": "Cloud", "url": "https://en.wikipedia.org/wiki/Cloud_computing", "description": "Wiki"}}],"estimated_minutes": 30,"activities": [{{"type": "notes", "description": "Study"}}],"unlock_rule": {{"type": "sequential"}},"reward": {{"xp": 50}}}}]}}"""
    
    print("Testing double brace conversion...")
    print(f"Input (first 100 chars): {ai_response_with_double_braces[:100]}...")
    
    # Count braces
    double_open = ai_response_with_double_braces.count('{{')
    double_close = ai_response_with_double_braces.count('}}')
    single_open = ai_response_with_double_braces.count('{') - (double_open * 2)
    single_close = ai_response_with_double_braces.count('}') - (double_close * 2)
    
    print(f"\nBrace counts:")
    print(f"  Double open: {double_open}, Double close: {double_close}")
    print(f"  Single open: {single_open}, Single close: {single_close}")
    
    # Apply fix
    if double_open > single_open and double_close > single_close:
        print("\n✓ Detected mostly double braces, converting to single...")
        fixed = ai_response_with_double_braces.replace('{{', '{').replace('}}', '}')
    else:
        print("\n✗ Not enough double braces to convert")
        fixed = ai_response_with_double_braces
    
    print(f"Fixed (first 100 chars): {fixed[:100]}...")
    
    # Try to parse
    try:
        parsed = json.loads(fixed)
        print("\n✓ SUCCESS - JSON parsed correctly!")
        print(f"  Title: {parsed['title']}")
        print(f"  Nodes: {len(parsed['nodes'])}")
        return True
    except json.JSONDecodeError as e:
        print(f"\n✗ FAILED - JSON parse error: {e}")
        return False

if __name__ == "__main__":
    import sys
    success = test_double_brace_conversion()
    sys.exit(0 if success else 1)
