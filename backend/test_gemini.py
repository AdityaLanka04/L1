#!/usr/bin/env python3
"""Test Gemini API directly to diagnose the issue"""

import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

GEMINI_API_KEY = os.getenv("GOOGLE_GENERATIVE_AI_KEY")

print(f"API Key: {GEMINI_API_KEY[:20]}...")

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)

# Try different models
models_to_test = [
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-pro"
]

for model_name in models_to_test:
    print(f"\n🧪 Testing model: {model_name}")
    model = genai.GenerativeModel(model_name)

    print("Sending test request...")
    
    try:
        # Test with timeout
        import signal
        
        def timeout_handler(signum, frame):
            raise TimeoutError("Request timed out")
        
        # Set 5 second timeout
        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(5)
        
        response = model.generate_content(
            "Say hello in one sentence.",
            generation_config={
                "temperature": 0.7,
                "max_output_tokens": 50,
            }
        )
        
        signal.alarm(0)  # Cancel timeout
        
        print(f"✅ Success! Response: {response.text}")
        break  # Found working model
        
    except TimeoutError:
        print(f"❌ Request timed out after 5 seconds")
    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {e}")
