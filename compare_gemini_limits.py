"""
Compare Gemini model rate limits
"""

print("=" * 80)
print("GEMINI MODEL RATE LIMITS COMPARISON (Free Tier)")
print("=" * 80)

models = {
    "Gemini 1.5 Flash": {
        "model_name": "gemini-1.5-flash",
        "requests_per_minute": 15,
        "tokens_per_minute": 1_000_000,
        "requests_per_day": 1500,
        "context_window": "1M tokens",
        "speed": "Very Fast",
        "quality": "Good",
        "cost": "FREE"
    },
    "Gemini 1.5 Pro": {
        "model_name": "gemini-1.5-pro",
        "requests_per_minute": 2,
        "tokens_per_minute": 32_000,
        "requests_per_day": 50,
        "context_window": "2M tokens",
        "speed": "Slower",
        "quality": "Excellent",
        "cost": "FREE (limited)"
    },
    "Gemini 2.0 Flash": {
        "model_name": "gemini-2.0-flash",
        "requests_per_minute": 10,
        "tokens_per_minute": 4_000_000,
        "requests_per_day": 1500,
        "context_window": "1M tokens",
        "speed": "Very Fast",
        "quality": "Better than 1.5",
        "cost": "FREE"
    },
    "Gemini 2.5 Flash": {
        "model_name": "gemini-2.5-flash",
        "requests_per_minute": 10,
        "tokens_per_minute": 4_000_000,
        "requests_per_day": 1000,
        "context_window": "1M tokens",
        "speed": "Very Fast",
        "quality": "Best",
        "cost": "FREE"
    }
}

for name, specs in models.items():
    print(f"\n{name}")
    print("-" * 80)
    print(f"  Model Name:          {specs['model_name']}")
    print(f"  Requests/Minute:     {specs['requests_per_minute']}")
    print(f"  Tokens/Minute:       {specs['tokens_per_minute']:,}")
    print(f"  Requests/Day:        {specs['requests_per_day']}")
    print(f"  Context Window:      {specs['context_window']}")
    print(f"  Speed:               {specs['speed']}")
    print(f"  Quality:             {specs['quality']}")
    print(f"  Cost:                {specs['cost']}")

print("\n" + "=" * 80)
print("RECOMMENDATION FOR YOUR USE CASE:")
print("=" * 80)
print("\n🏆 BEST CHOICE: Gemini 1.5 Flash")
print("\nReasons:")
print("  ✅ Highest requests/minute (15 vs 10)")
print("  ✅ Highest requests/day (1500 vs 1000)")
print("  ✅ 1M tokens/minute (plenty for educational content)")
print("  ✅ Very fast responses")
print("  ✅ Good quality for educational use")
print("  ✅ Most generous free tier")
print("\n📝 Use: gemini-1.5-flash")
print("=" * 80)
