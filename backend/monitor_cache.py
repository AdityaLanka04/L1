#!/usr/bin/env python3
"""
Cache Monitoring Script
Real-time monitoring of the Brainwave caching system
"""
import sys
import os
import time
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def clear_screen():
    """Clear terminal screen"""
    os.system('clear' if os.name != 'nt' else 'cls')

def format_bytes(bytes_val):
    """Format bytes to human readable"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_val < 1024.0:
            return f"{bytes_val:.2f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.2f} TB"

def print_header():
    """Print header"""
    print("=" * 80)
    print("🚀 BRAINWAVE CACHE MONITOR".center(80))
    print("=" * 80)
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()

def print_cache_stats(stats):
    """Print cache statistics in a nice format"""
    
    # Overall metrics
    print("📊 OVERALL METRICS")
    print("-" * 80)
    
    total_hits = 0
    total_misses = 0
    
    for cache_name, cache_stats in stats.items():
        if isinstance(cache_stats, dict):
            total_hits += cache_stats.get("hits", 0)
            total_misses += cache_stats.get("misses", 0)
    
    total_requests = total_hits + total_misses
    hit_rate = (total_hits / total_requests * 100) if total_requests > 0 else 0
    
    print(f"  Total Requests:  {total_requests:,}")
    print(f"  Cache Hits:      {total_hits:,} ({hit_rate:.1f}%)")
    print(f"  Cache Misses:    {total_misses:,}")
    print(f"  Hit Rate:        {'🟢' if hit_rate > 70 else '🟡' if hit_rate > 40 else '🔴'} {hit_rate:.2f}%")
    print()
    
    # Individual cache stats
    print("💾 CACHE DETAILS")
    print("-" * 80)
    
    cache_order = [
        ("ai_response_cache", "AI Response Cache"),
        ("rag_query_cache", "RAG Query Cache"),
        ("db_query_cache", "Database Query Cache"),
        ("embedding_cache", "Embedding Cache"),
        ("api_response_cache", "API Response Cache")
    ]
    
    for cache_key, cache_label in cache_order:
        if cache_key in stats and isinstance(stats[cache_key], dict):
            cache_stats = stats[cache_key]
            
            hits = cache_stats.get("hits", 0)
            misses = cache_stats.get("misses", 0)
            total = hits + misses
            hit_rate = (hits / total * 100) if total > 0 else 0
            size = cache_stats.get("cache_size", 0)
            max_size = cache_stats.get("max_size", 0)
            evictions = cache_stats.get("evictions", 0)
            
            print(f"\n  {cache_label}")
            print(f"    Requests:  {total:,}")
            print(f"    Hits:      {hits:,} ({hit_rate:.1f}%)")
            print(f"    Misses:    {misses:,}")
            print(f"    Size:      {size:,} / {max_size:,} ({size/max_size*100:.1f}% full)" if max_size > 0 else f"    Size:      {size:,}")
            if evictions > 0:
                print(f"    Evictions: {evictions:,}")
    
    print()
    
    # Redis status
    print("🔴 REDIS STATUS")
    print("-" * 80)
    redis_available = stats.get("redis_available", False)
    print(f"  Status: {'✅ Connected' if redis_available else '❌ Not Connected (using in-memory cache)'}")
    print()
    
    # Performance insights
    print("💡 INSIGHTS")
    print("-" * 80)
    
    insights = []
    
    # Check overall hit rate
    if total_requests > 100:
        if hit_rate > 70:
            insights.append("✅ Excellent cache performance! Saving significant costs.")
        elif hit_rate > 40:
            insights.append("🟡 Good cache performance. Consider increasing TTLs.")
        else:
            insights.append("🔴 Low cache hit rate. Check if queries are too diverse.")
    else:
        insights.append("ℹ️  Not enough data yet. Keep using the system.")
    
    # Check AI cache
    ai_stats = stats.get("ai_response_cache", {})
    ai_hits = ai_stats.get("hits", 0)
    ai_total = ai_hits + ai_stats.get("misses", 0)
    if ai_total > 50:
        ai_hit_rate = (ai_hits / ai_total * 100)
        token_savings = ai_hit_rate
        insights.append(f"💰 Estimated token savings: ~{token_savings:.0f}%")
    
    # Check cache sizes
    for cache_key, cache_label in cache_order:
        if cache_key in stats and isinstance(stats[cache_key], dict):
            cache_stats = stats[cache_key]
            size = cache_stats.get("cache_size", 0)
            max_size = cache_stats.get("max_size", 0)
            if max_size > 0 and size / max_size > 0.9:
                insights.append(f"⚠️  {cache_label} is {size/max_size*100:.0f}% full")
    
    # Check evictions
    for cache_key, cache_label in cache_order:
        if cache_key in stats and isinstance(stats[cache_key], dict):
            cache_stats = stats[cache_key]
            evictions = cache_stats.get("evictions", 0)
            total = cache_stats.get("total_requests", 0)
            if total > 0 and evictions / total > 0.2:
                insights.append(f"⚠️  High eviction rate in {cache_label}")
    
    if not insights:
        insights.append("✅ All systems operating normally")
    
    for insight in insights:
        print(f"  {insight}")
    
    print()

def monitor_once():
    """Monitor cache once and display stats"""
    try:
        from caching.cache_manager import CacheManager
        import os
        from dotenv import load_dotenv
        
        load_dotenv()
        
        # Create cache manager with same settings as backend
        redis_url = os.getenv("REDIS_URL")
        enable_redis = os.getenv("ENABLE_REDIS_CACHE", "true").lower() == "true"
        
        cache_manager = CacheManager(
            redis_url=redis_url,
            max_memory_size=10000,
            default_ttl=3600,
            enable_redis=enable_redis
        )
        
        if not cache_manager:
            print("❌ Cache manager not initialized")
            print("   Make sure the backend is running")
            return False
        
        stats = cache_manager.get_stats()
        
        clear_screen()
        print_header()
        print_cache_stats(stats)
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\nMake sure:")
        print("  1. The backend is running")
        print("  2. The cache system is initialized")
        print("  3. You're in the backend directory")
        import traceback
        traceback.print_exc()
        return False

def monitor_continuous(interval=5):
    """Monitor cache continuously"""
    print("Starting continuous monitoring...")
    print(f"Refreshing every {interval} seconds")
    print("Press Ctrl+C to stop")
    print()
    time.sleep(2)
    
    try:
        while True:
            success = monitor_once()
            if success:
                print(f"Refreshing in {interval} seconds... (Press Ctrl+C to stop)")
                time.sleep(interval)
            else:
                print("\nRetrying in 10 seconds...")
                time.sleep(10)
    except KeyboardInterrupt:
        print("\n\n✅ Monitoring stopped")

def clear_cache(cache_type="all"):
    """Clear cache"""
    try:
        from caching.cache_manager import CacheManager
        import os
        from dotenv import load_dotenv
        
        load_dotenv()
        
        redis_url = os.getenv("REDIS_URL")
        enable_redis = os.getenv("ENABLE_REDIS_CACHE", "true").lower() == "true"
        
        cache_manager = CacheManager(
            redis_url=redis_url,
            max_memory_size=10000,
            default_ttl=3600,
            enable_redis=enable_redis
        )
        
        if not cache_manager:
            print("❌ Cache manager not initialized")
            return
        
        print(f"Clearing {cache_type} cache...")
        
        if cache_type == "all":
            cache_manager.clear_all()
            print("✅ All caches cleared")
        elif cache_type == "ai":
            cache_manager.ai_response_cache.clear()
            print("✅ AI response cache cleared")
        elif cache_type == "rag":
            cache_manager.rag_query_cache.clear()
            print("✅ RAG query cache cleared")
        elif cache_type == "db":
            cache_manager.db_query_cache.clear()
            print("✅ Database query cache cleared")
        elif cache_type == "embedding":
            cache_manager.embedding_cache.clear()
            print("✅ Embedding cache cleared")
        elif cache_type == "api":
            cache_manager.api_response_cache.clear()
            print("✅ API response cache cleared")
        else:
            print(f"❌ Unknown cache type: {cache_type}")
            print("   Valid types: all, ai, rag, db, embedding, api")
        
    except Exception as e:
        print(f"❌ Error: {e}")

def cleanup_expired():
    """Clean up expired cache entries"""
    try:
        from caching.cache_manager import CacheManager
        import os
        from dotenv import load_dotenv
        
        load_dotenv()
        
        redis_url = os.getenv("REDIS_URL")
        enable_redis = os.getenv("ENABLE_REDIS_CACHE", "true").lower() == "true"
        
        cache_manager = CacheManager(
            redis_url=redis_url,
            max_memory_size=10000,
            default_ttl=3600,
            enable_redis=enable_redis
        )
        
        if not cache_manager:
            print("❌ Cache manager not initialized")
            return
        
        print("Cleaning up expired entries...")
        cache_manager.cleanup_expired()
        print("✅ Cleanup complete")
        
    except Exception as e:
        print(f"❌ Error: {e}")

def show_help():
    """Show help message"""
    print("""
🚀 Brainwave Cache Monitor

Usage:
  python monitor_cache.py [command] [options]

Commands:
  (no command)          Show cache stats once
  watch                 Continuously monitor cache (refresh every 5s)
  watch <seconds>       Continuously monitor with custom interval
  clear [type]          Clear cache (types: all, ai, rag, db, embedding, api)
  cleanup               Remove expired cache entries
  help                  Show this help message

Examples:
  python monitor_cache.py                    # Show stats once
  python monitor_cache.py watch              # Monitor continuously
  python monitor_cache.py watch 10           # Monitor every 10 seconds
  python monitor_cache.py clear all          # Clear all caches
  python monitor_cache.py clear ai           # Clear only AI cache
  python monitor_cache.py cleanup            # Clean up expired entries

Tips:
  - Run this while the backend is running
  - Use 'watch' mode to see real-time cache performance
  - Clear cache if you want to test fresh performance
  - Cleanup expired entries to free memory
""")

if __name__ == "__main__":
    if len(sys.argv) == 1:
        # No arguments - show stats once
        monitor_once()
    
    elif sys.argv[1] == "watch":
        # Continuous monitoring
        interval = 5
        if len(sys.argv) > 2:
            try:
                interval = int(sys.argv[2])
            except ValueError:
                print(f"❌ Invalid interval: {sys.argv[2]}")
                sys.exit(1)
        monitor_continuous(interval)
    
    elif sys.argv[1] == "clear":
        # Clear cache
        cache_type = "all"
        if len(sys.argv) > 2:
            cache_type = sys.argv[2]
        clear_cache(cache_type)
    
    elif sys.argv[1] == "cleanup":
        # Cleanup expired entries
        cleanup_expired()
    
    elif sys.argv[1] == "help":
        # Show help
        show_help()
    
    else:
        print(f"❌ Unknown command: {sys.argv[1]}")
        print("   Run 'python monitor_cache.py help' for usage")
        sys.exit(1)
