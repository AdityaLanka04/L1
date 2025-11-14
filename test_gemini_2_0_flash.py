"""
Test Gemini 2.0 Flash integration
"""
import os
import sys
sys.path.append('backend')

from dotenv import load_dotenv
load_dotenv('backend/.env')

GEMINI_API_KEY = os.getenv("GOOGLE_GENERATIVE_AI_KEY")

print("=" * 80)
print("TESTING GEMINI 2.0 FLASH")
print("=" * 80)

if not GEMINI_API_KEY:
    print("❌ No GEMINI API key found")
    exit(1)

print(f"✅ API Key found: {GEMINI_API_KEY[:20]}...")

try:
    import google.generativeai as genai
    
    # Configure
    genai.configure(api_key=GEMINI_API_KEY)
    print("✅ Gemini configured")
    
    # Create model
    model = genai.GenerativeModel("gemini-2.0-flash")
    print("✅ Model created: gemini-2.0-flash")
    
    # Test generation
    print("\n📡 Testing generation...")
    response = model.generate_content("Say 'Hello from Gemini 2.0 Flash!' in one sentence.")
    print(f"✅ Response received: {response.text}")
    
    print("\n" + "=" * 80)
    print("✅ SUCCESS! Gemini 2.0 Flash is working perfectly!")
    print("=" * 80)
    print("\nModel Details:")
    print("  - Model: gemini-2.0-flash")
    print("  - Requests/Minute: 10")
    print("  - Tokens/Minute: 4,000,000")
    print("  - Requests/Day: 1,500")
    print("  - Status: WORKING ✅")
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
