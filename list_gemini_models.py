"""
Script to list all available Gemini models
"""
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')

GEMINI_API_KEY = os.getenv("GOOGLE_GENERATIVE_AI_KEY")

if not GEMINI_API_KEY:
    print("❌ No GEMINI API key found in .env")
    exit(1)

print(f"✅ Using API key: {GEMINI_API_KEY[:20]}...")

try:
    import google.generativeai as genai
    
    genai.configure(api_key=GEMINI_API_KEY)
    
    print("\n📋 Available Gemini Models:\n")
    print("-" * 80)
    
    for model in genai.list_models():
        if 'generateContent' in model.supported_generation_methods:
            print(f"✅ {model.name}")
            print(f"   Display Name: {model.display_name}")
            print(f"   Description: {model.description[:100]}...")
            print(f"   Supported: {model.supported_generation_methods}")
            print("-" * 80)
    
    print("\n💡 Recommended models:")
    print("   - models/gemini-1.5-flash (fast, free tier)")
    print("   - models/gemini-1.5-pro (more capable)")
    print("   - models/gemini-pro (older, stable)")
    
except ImportError:
    print("❌ google-generativeai not installed")
    print("Run: pip install google-generativeai")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
