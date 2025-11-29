import os
import sys
sys.path.insert(0, 'backend')

from dotenv import load_dotenv
load_dotenv('backend/.env')

# Test Gemini
print("Testing Gemini API...")
try:
    import google.generativeai as genai
    GEMINI_API_KEY = os.getenv("GOOGLE_GENERATIVE_AI_KEY") or os.getenv("GEMINI_API_KEY")
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    response = model.generate_content("Say hello in one sentence")
    print(f"✅ Gemini works: {response.text}")
except Exception as e:
    print(f"❌ Gemini error: {e}")

# Test Groq
print("\nTesting Groq API...")
try:
    from groq import Groq
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    client = Groq(api_key=GROQ_API_KEY)
    response = client.chat.completions.create(
        messages=[{"role": "user", "content": "Say hello in one sentence"}],
        model="llama-3.3-70b-versatile",
        temperature=0.7,
        max_tokens=100
    )
    print(f"✅ Groq works: {response.choices[0].message.content}")
except Exception as e:
    print(f"❌ Groq error: {e}")
