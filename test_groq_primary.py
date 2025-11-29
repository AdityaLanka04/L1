import os
import sys
sys.path.insert(0, 'backend')

from dotenv import load_dotenv
load_dotenv('backend/.env')

from groq import Groq

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=GROQ_API_KEY)

from ai_utils import UnifiedAIClient

print("Testing UnifiedAIClient with Groq as PRIMARY...")
print("="*60)

# Pass None for gemini_client to force Groq as primary
unified_ai = UnifiedAIClient(
    gemini_client=None,  # Disable Gemini
    groq_client=groq_client,
    gemini_model="gemini-2.0-flash",
    groq_model="llama-3.3-70b-versatile",
    gemini_api_key=None
)

print(f"Primary AI: {unified_ai.primary_ai}")

try:
    response = unified_ai.generate("What is Python? Answer in one sentence.", max_tokens=100, temperature=0.7)
    print(f"\n✅ SUCCESS!")
    print(f"Response: {response}")
except Exception as e:
    print(f"\n❌ FAILED: {e}")
    import traceback
    traceback.print_exc()
