#!/usr/bin/env python3
"""
Test AI response caching directly
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from ai_utils import UnifiedAIClient
from caching import get_cache_manager
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_ai_caching():
    """Test that AI responses are cached"""
    
    # Get cache manager
    cache_manager = get_cache_manager()
    print(f"\n✅ Cache manager: {cache_manager}")
    print(f"   Has cache_manager: {cache_manager is not None}")
    
    # Import unified_ai from main
    from main import unified_ai
    
    print(f"\n✅ Unified AI client: {unified_ai}")
    print(f"   Has cache_manager: {unified_ai.cache_manager is not None}")
    
    # Test prompt
    test_prompt = "What is 2+2? Answer in one word."
    
    print(f"\n🧪 TEST 1: First call (should MISS cache)")
    print(f"   Prompt: {test_prompt}")
    
    # First call - should miss cache
    response1 = unified_ai.generate(test_prompt, max_tokens=50, temperature=0.7)
    print(f"   Response: {response1[:100]}")
    
    # Check cache stats
    stats = cache_manager.get_stats()
    print(f"\n📊 Cache stats after first call:")
    print(f"   Full stats: {stats}")
    
    if 'cache_details' in stats:
        ai_stats = stats['cache_details']['ai_response_cache']
    else:
        ai_stats = stats.get('ai_response_cache', {})
    
    print(f"   Requests: {ai_stats.get('total_requests', 0)}")
    print(f"   Hits: {ai_stats.get('hits', 0)}")
    print(f"   Misses: {ai_stats.get('misses', 0)}")
    print(f"   Cache size: {ai_stats.get('cache_size', 0)}")
    
    print(f"\n🧪 TEST 2: Second call with SAME prompt (should HIT cache)")
    
    # Second call - should hit cache
    response2 = unified_ai.generate(test_prompt, max_tokens=50, temperature=0.7)
    print(f"   Response: {response2[:100]}")
    
    # Check cache stats again
    stats = cache_manager.get_stats()
    print(f"\n📊 Cache stats after second call:")
    print(f"   Full stats: {stats}")
    
    if 'cache_details' in stats:
        ai_stats = stats['cache_details']['ai_response_cache']
    else:
        ai_stats = stats.get('ai_response_cache', {})
    
    print(f"   Requests: {ai_stats.get('total_requests', 0)}")
    print(f"   Hits: {ai_stats.get('hits', 0)}")
    print(f"   Misses: {ai_stats.get('misses', 0)}")
    print(f"   Cache size: {ai_stats.get('cache_size', 0)}")
    print(f"   Hit rate: {ai_stats.get('hit_rate_percent', 0)}%")
    
    # Verify
    if ai_stats.get('hits', 0) > 0:
        print(f"\n✅ SUCCESS! Cache is working!")
        print(f"   Second call was served from cache (saved API tokens!)")
    else:
        print(f"\n❌ FAILED! Cache not working")
        print(f"   Both calls hit the API")
    
    return ai_stats.get('hits', 0) > 0

if __name__ == "__main__":
    success = test_ai_caching()
    sys.exit(0 if success else 1)
