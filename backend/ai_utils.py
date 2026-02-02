"""
Unified AI utilities for Gemini (primary) and Groq (fallback)
With integrated caching system
"""
import logging
import json
from typing import Optional

logger = logging.getLogger(__name__)

# Import cache manager
try:
    from caching.cache_manager import get_cache_manager
    CACHE_AVAILABLE = True
except ImportError:
    try:
        from caching import get_cache_manager
        CACHE_AVAILABLE = True
    except ImportError:
        CACHE_AVAILABLE = False
        logger.warning("Cache manager not available")

class UnifiedAIClient:
    """Unified client that uses Gemini as primary, Groq as fallback"""
    
    def __init__(self, gemini_client=None, groq_client=None, gemini_model: str = "gemini-2.0-flash", groq_model: str = "llama-3.3-70b-versatile", gemini_api_key: str = None):
        self.gemini_module = gemini_client  # This is the genai module
        self.groq_client = groq_client
        self.gemini_model = gemini_model
        self.groq_model = groq_model
        self.gemini_api_key = gemini_api_key
        
        # Initialize cache manager
        self.cache_manager = get_cache_manager() if CACHE_AVAILABLE else None
        if self.cache_manager:
            logger.info("✅ AI client using cache manager")
        
        # Create the actual Gemini model instance
        if gemini_client:
            try:
                logger.info(f"Creating Gemini model with: {type(gemini_client)}")
                self.gemini_client = gemini_client.GenerativeModel(gemini_model)
                logger.info(f"Gemini model created: {type(self.gemini_client)}")
                self.primary_ai = "gemini"
                logger.info(f" UnifiedAIClient using GEMINI as primary (model: {gemini_model})")
            except Exception as e:
                logger.error(f" Failed to create Gemini model: {e}")
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
        Includes intelligent caching to reduce token usage
        
        Args:
            prompt: The prompt to send
            max_tokens: Maximum tokens in response
            temperature: Temperature for generation
        
        Returns:
            AI response text
        """
        # Check cache first
        if self.cache_manager:
            cached_response = self.cache_manager.get_ai_response(prompt, temperature, max_tokens)
            if cached_response:
                logger.info(f"✅ AI cache hit - saved tokens!")
                return cached_response
        
        try:
            if self.primary_ai == "gemini" and self.gemini_api_key:
                logger.info(f" Calling Gemini REST API directly...")
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
                            logger.info(f" Sending REST request to Gemini (attempt {attempt + 1}/{max_retries})...")
                            response = requests.post(url, json=payload, timeout=60)
                            
                            if response.status_code == 200:
                                data = response.json()
                                if 'candidates' in data and len(data['candidates']) > 0:
                                    text = data['candidates'][0]['content']['parts'][0]['text']
                                    logger.info(f" Gemini REST response received: {len(text)} chars")
                                    
                                    # Cache the response
                                    if self.cache_manager:
                                        self.cache_manager.set_ai_response(prompt, temperature, max_tokens, text)
                                    
                                    return text
                                else:
                                    logger.error(f" Gemini response has no candidates: {data}")
                                    raise Exception("Gemini response has no candidates")
                            elif response.status_code == 429:
                                # Rate limit - immediately fall back to Groq instead of retrying
                                logger.warning(f" Gemini rate limited (429), falling back to Groq immediately...")
                                raise Exception(f"Gemini API quota exceeded. Please wait for quota reset or use Groq API instead.")
                            elif response.status_code == 400 and "quota" in response.text.lower():
                                logger.warning(f" Gemini quota exceeded, falling back to Groq...")
                                raise Exception(f"Gemini API quota exceeded. Falling back to Groq API.")
                            else:
                                logger.error(f" Gemini REST API error: {response.status_code} - {response.text}")
                                if attempt == max_retries - 1:
                                    raise Exception(f"Gemini API error: {response.status_code}")
                                time.sleep(1)
                                continue
                                
                        except requests.exceptions.Timeout:
                            logger.warning(f" Gemini timeout on attempt {attempt + 1}")
                            if attempt == max_retries - 1:
                                raise
                            time.sleep(2)
                            continue
                        except requests.exceptions.ConnectionError:
                            logger.warning(f" Gemini connection error on attempt {attempt + 1}")
                            if attempt == max_retries - 1:
                                raise
                            time.sleep(2)
                            continue
                        
                except Exception as gemini_error:
                    logger.error(f" Gemini error: {type(gemini_error).__name__}: {gemini_error}")
                    raise
            elif self.groq_client:
                logger.info(" Calling Groq API...")
                response = self.groq_client.chat.completions.create(
                    model=self.groq_model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                logger.info(f" Groq response received")
                result = response.choices[0].message.content.strip()
                
                # Cache the response
                if self.cache_manager:
                    self.cache_manager.set_ai_response(prompt, temperature, max_tokens, result)
                
                return result
            else:
                logger.error(" No AI client available!")
                raise Exception("No AI client available")
        except Exception as e:
            logger.error(f" Primary AI ({self.primary_ai}) failed: {type(e).__name__}: {e}")
            # Fallback
            if self.primary_ai == "gemini" and self.groq_client:
                logger.warning(" Falling back to Groq...")
                try:
                    response = self.groq_client.chat.completions.create(
                        model=self.groq_model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=temperature,
                        max_tokens=max_tokens
                    )
                    logger.info(" Groq fallback successful")
                    result = response.choices[0].message.content.strip()
                    
                    # Cache the fallback response
                    if self.cache_manager:
                        self.cache_manager.set_ai_response(prompt, temperature, max_tokens, result)
                    
                    return result
                except Exception as groq_error:
                    logger.error(f" Groq fallback also failed: {groq_error}")
                    raise
            elif self.primary_ai == "groq" and self.gemini_client:
                logger.warning(" Falling back to Gemini...")
                try:
                    response = self.gemini_client.generate_content(prompt)
                    logger.info(" Gemini fallback successful")
                    return response.text
                except Exception as gemini_error:
                    logger.error(f" Gemini fallback also failed: {gemini_error}")
                    raise
            else:
                logger.error(f" No fallback available. Both clients failed.")
                raise Exception(f"Both AI clients failed: {e}")
    
    def generate_stream(self, prompt: str, max_tokens: int = 2000, temperature: float = 0.7):
        """
        Generate AI response with streaming (token-by-token)
        
        Args:
            prompt: The prompt to send
            max_tokens: Maximum tokens in response
            temperature: Temperature for generation
        
        Yields:
            Chunks of text as they arrive
        """
        # For streaming, prefer Groq as it has better streaming support
        if self.groq_client:
            logger.info(" Calling Groq API with streaming...")
            try:
                stream = self.groq_client.chat.completions.create(
                    model=self.groq_model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True
                )
                
                for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
                
                logger.info(" Groq streaming completed")
                return
                        
            except Exception as groq_error:
                logger.error(f" Groq streaming error: {groq_error}")
                # Don't raise, try Gemini fallback
        
        # Fallback to Gemini (non-streaming, but split into chunks)
        if self.primary_ai == "gemini" and self.gemini_api_key:
            logger.warning(" Using Gemini with simulated streaming (Groq unavailable)")
            try:
                # Get full response from Gemini
                full_response = self.generate(prompt, max_tokens, temperature)
                
                # Split into word-by-word chunks for streaming effect
                words = full_response.split(' ')
                for i, word in enumerate(words):
                    if i < len(words) - 1:
                        yield word + ' '
                    else:
                        yield word
                
                logger.info(" Gemini simulated streaming completed")
                return
                        
            except Exception as gemini_error:
                logger.error(f" Gemini fallback error: {gemini_error}")
                raise
        
        # No AI available
        logger.error(" No AI client available for streaming!")
        raise Exception("No AI client available for streaming")


