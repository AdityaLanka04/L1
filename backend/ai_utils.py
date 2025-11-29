"""
Unified AI utilities for Gemini (primary) and Groq (fallback)
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class UnifiedAIClient:
    """Unified client that uses Gemini as primary, Groq as fallback"""
    
    def __init__(self, gemini_client=None, groq_client=None, gemini_model: str = "gemini-2.0-flash", groq_model: str = "llama-3.3-70b-versatile", gemini_api_key: str = None):
        self.gemini_module = gemini_client  # This is the genai module
        self.groq_client = groq_client
        self.gemini_model = gemini_model
        self.groq_model = groq_model
        self.gemini_api_key = gemini_api_key
        
        # Create the actual Gemini model instance
        if gemini_client:
            try:
                logger.info(f"Creating Gemini model with: {type(gemini_client)}")
                self.gemini_client = gemini_client.GenerativeModel(gemini_model)
                logger.info(f"Gemini model created: {type(self.gemini_client)}")
                self.primary_ai = "gemini"
                logger.info(f"✅ UnifiedAIClient using GEMINI as primary (model: {gemini_model})")
            except Exception as e:
                logger.error(f"❌ Failed to create Gemini model: {e}")
                import traceback
                traceback.print_exc()
                self.gemini_client = None
                if groq_client:
                    self.primary_ai = "groq"
                    logger.info("UnifiedAIClient using GROQ as primary (Gemini failed)")
                else:
                    raise ValueError("Both AI clients failed to initialize")
        elif groq_client:
            self.gemini_client = None
            self.primary_ai = "groq"
            logger.info("UnifiedAIClient using GROQ as primary")
        else:
            raise ValueError("At least one AI client (Gemini or Groq) must be provided")
    
    def generate(self, prompt: str, max_tokens: int = 2000, temperature: float = 0.7) -> str:
        """
        Generate AI response with Gemini as primary, Groq as fallback
        
        Args:
            prompt: The prompt to send
            max_tokens: Maximum tokens in response
            temperature: Temperature for generation
        
        Returns:
            AI response text
        """
        try:
            if self.primary_ai == "gemini" and self.gemini_api_key:
                logger.info(f"📡 Calling Gemini REST API directly...")
                try:
                    # Use REST API directly to avoid SDK hanging issues
                    import requests
                    import json
                    import time
                    
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent?key={self.gemini_api_key}"
                    
                    payload = {
                        "contents": [{
                            "parts": [{"text": prompt}]
                        }],
                        "generationConfig": {
                            "temperature": temperature,
                            "maxOutputTokens": max_tokens,
                        }
                    }
                    
                    # Retry logic for Gemini
                    max_retries = 3
                    for attempt in range(max_retries):
                        try:
                            logger.info(f"📡 Sending REST request to Gemini (attempt {attempt + 1}/{max_retries})...")
                            response = requests.post(url, json=payload, timeout=60)
                            
                            if response.status_code == 200:
                                data = response.json()
                                if 'candidates' in data and len(data['candidates']) > 0:
                                    text = data['candidates'][0]['content']['parts'][0]['text']
                                    logger.info(f"✅ Gemini REST response received: {len(text)} chars")
                                    return text
                                else:
                                    logger.error(f"❌ Gemini response has no candidates: {data}")
                                    raise Exception("Gemini response has no candidates")
                            elif response.status_code == 429:
                                # Rate limit - immediately fall back to Groq instead of retrying
                                logger.warning(f"⚠️ Gemini rate limited (429), falling back to Groq immediately...")
                                raise Exception(f"Gemini quota exceeded: {response.status_code}")
                            else:
                                logger.error(f"❌ Gemini REST API error: {response.status_code} - {response.text}")
                                if attempt == max_retries - 1:
                                    raise Exception(f"Gemini API error: {response.status_code}")
                                time.sleep(1)
                                continue
                                
                        except requests.exceptions.Timeout:
                            logger.warning(f"⚠️ Gemini timeout on attempt {attempt + 1}")
                            if attempt == max_retries - 1:
                                raise
                            time.sleep(2)
                            continue
                        except requests.exceptions.ConnectionError:
                            logger.warning(f"⚠️ Gemini connection error on attempt {attempt + 1}")
                            if attempt == max_retries - 1:
                                raise
                            time.sleep(2)
                            continue
                        
                except Exception as gemini_error:
                    logger.error(f"❌ Gemini error: {type(gemini_error).__name__}: {gemini_error}")
                    raise
            elif self.groq_client:
                logger.info("📡 Calling Groq API...")
                response = self.groq_client.chat.completions.create(
                    model=self.groq_model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                logger.info(f"✅ Groq response received")
                return response.choices[0].message.content.strip()
            else:
                logger.error("❌ No AI client available!")
                raise Exception("No AI client available")
        except Exception as e:
            logger.error(f"❌ Primary AI ({self.primary_ai}) failed: {type(e).__name__}: {e}")
            # Fallback
            if self.primary_ai == "gemini" and self.groq_client:
                logger.warning("⚠️ Falling back to Groq...")
                try:
                    response = self.groq_client.chat.completions.create(
                        model=self.groq_model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=temperature,
                        max_tokens=max_tokens
                    )
                    logger.info("✅ Groq fallback successful")
                    return response.choices[0].message.content.strip()
                except Exception as groq_error:
                    logger.error(f"❌ Groq fallback also failed: {groq_error}")
                    raise
            elif self.primary_ai == "groq" and self.gemini_client:
                logger.warning("⚠️ Falling back to Gemini...")
                try:
                    response = self.gemini_client.generate_content(prompt)
                    logger.info("✅ Gemini fallback successful")
                    return response.text
                except Exception as gemini_error:
                    logger.error(f"❌ Gemini fallback also failed: {gemini_error}")
                    raise
            else:
                logger.error(f"❌ No fallback available. Both clients failed.")
                raise Exception(f"Both AI clients failed: {e}")
