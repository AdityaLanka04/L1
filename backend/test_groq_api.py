"""
Quick test to verify Groq API is working
Run this to check if your Groq API key is valid
"""
import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    print("❌ GROQ_API_KEY not found in .env file")
    exit(1)

print(f"✅ GROQ_API_KEY found: {GROQ_API_KEY[:20]}...")

try:
    from groq import Groq
    
    client = Groq(api_key=GROQ_API_KEY)
    
    print("\n🧪 Testing Groq API...")
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "user", "content": "Say 'Hello, Groq is working!' in exactly 5 words."}
        ],
        max_tokens=50
    )
    
    result = response.choices[0].message.content
    print(f"✅ Groq API Response: {result}")
    print("\n✅ SUCCESS! Groq API is working correctly.")
    print("\nYour YouTube summary feature should work now.")
    print("The 'V1 out of credits' error was from Gemini API hitting quota limits.")
    print("Groq has much higher limits (14,400 requests/day vs 1,500 for Gemini).")
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    print("\nTroubleshooting:")
    print("1. Check if your GROQ_API_KEY is valid")
    print("2. Get a new key from: https://console.groq.com/keys")
    print("3. Make sure 'groq' package is installed: pip install groq")
