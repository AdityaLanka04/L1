#!/usr/bin/env python3
"""
Quick test to verify Gemini API connection and timeout settings
"""
import os
import sys
import requests
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')

GEMINI_API_KEY = os.getenv("GOOGLE_GENERATIVE_AI_KEY")

if not GEMINI_API_KEY:
    print("❌ No GEMINI API key found in backend/.env")
    print("Please check that GOOGLE_GENERATIVE_AI_KEY is set in backend/.env")
    sys.exit(1)

print(f"✅ API Key found: {GEMINI_API_KEY[:20]}...")

# Test Gemini connection with improved settings
def test_gemini_connection():
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    
    payload = {
        "contents": [{
            "parts": [{"text": "Hello! Please respond with a simple greeting and confirm you're working properly."}]
        }],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 100,
        }
    }
    
    print("\n🔄 Testing Gemini connection...")
    start_time = time.time()
    
    try:
        response = requests.post(url, json=payload, timeout=60)
        end_time = time.time()
        
        print(f"⏱️  Response time: {end_time - start_time:.2f} seconds")
        
        if response.status_code == 200:
            data = response.json()
            if 'candidates' in data and len(data['candidates']) > 0:
                text = data['candidates'][0]['content']['parts'][0]['text']
                print(f"✅ Gemini response: {text}")
                return True
            else:
                print(f"❌ No candidates in response: {data}")
                return False
        else:
            print(f"❌ HTTP Error {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out after 60 seconds")
        return False
    except requests.exceptions.ConnectionError as e:
        print(f"❌ Connection error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("🧪 GEMINI CONNECTION TEST")
    print("=" * 60)
    
    success = test_gemini_connection()
    
    if success:
        print("\n✅ Gemini is working properly!")
        print("Your AI chat should now use Gemini as the primary AI.")
    else:
        print("\n❌ Gemini connection failed.")
        print("The system will fall back to Groq for AI responses.")
        
    print("\n" + "=" * 60)