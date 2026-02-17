import logging
import json
import time
from typing import Optional

import requests

logger = logging.getLogger(__name__)


class UnifiedAIClient:

    def __init__(
        self,
        gemini_client=None,
        groq_client=None,
        gemini_model: str = "gemini-2.0-flash",
        groq_model: str = "llama-3.3-70b-versatile",
        gemini_api_key: str = None,
    ):
        self.gemini_module = gemini_client
        self.groq_client = groq_client
        self.gemini_model = gemini_model
        self.groq_model = groq_model
        self.gemini_api_key = gemini_api_key

        if gemini_client:
            try:
                self.gemini_client = gemini_client.GenerativeModel(gemini_model)
                self.primary_ai = "gemini"
            except Exception:
                self.gemini_client = None
                if groq_client:
                    self.primary_ai = "groq"
                else:
                    raise ValueError("Both AI clients failed to initialize")
        elif groq_client:
            self.gemini_client = None
            self.primary_ai = "groq"
        else:
            raise ValueError("At least one AI client (Gemini or Groq) must be provided")

    def generate(
        self,
        prompt: str,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        use_cache: bool = False,
        conversation_id: str = None,
    ) -> str:
        try:
            if self.primary_ai == "gemini" and self.gemini_api_key:
                return self._call_gemini(prompt, max_tokens, temperature)
            elif self.groq_client:
                return self._call_groq(prompt, max_tokens, temperature)
            else:
                raise Exception("No AI client available")
        except Exception as e:
            logger.error(f"Primary AI ({self.primary_ai}) failed: {e}")
            return self._fallback(prompt, max_tokens, temperature)

    def _call_gemini(self, prompt: str, max_tokens: int, temperature: float) -> str:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.gemini_model}:generateContent?key={self.gemini_api_key}"
        )
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        for attempt in range(3):
            try:
                resp = requests.post(url, json=payload, timeout=60)
                if resp.status_code == 200:
                    data = resp.json()
                    if "candidates" in data and data["candidates"]:
                        return data["candidates"][0]["content"]["parts"][0]["text"]
                    raise Exception("Gemini response has no candidates")
                if resp.status_code in (429, 400) and "quota" in resp.text.lower():
                    raise Exception("Gemini quota exceeded")
                if attempt == 2:
                    raise Exception(f"Gemini API error: {resp.status_code}")
                time.sleep(1)
            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError):
                if attempt == 2:
                    raise
                time.sleep(2)
        raise Exception("Gemini request failed after retries")

    def _call_groq(self, prompt: str, max_tokens: int, temperature: float) -> str:
        resp = self.groq_client.chat.completions.create(
            model=self.groq_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content.strip()

    def _fallback(self, prompt: str, max_tokens: int, temperature: float) -> str:
        if self.primary_ai == "gemini" and self.groq_client:
            return self._call_groq(prompt, max_tokens, temperature)
        if self.primary_ai == "groq" and self.gemini_api_key:
            return self._call_gemini(prompt, max_tokens, temperature)
        raise Exception("No fallback AI client available")

    def generate_stream(self, prompt: str, max_tokens: int = 2000, temperature: float = 0.7):
        if self.groq_client:
            try:
                stream = self.groq_client.chat.completions.create(
                    model=self.groq_model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True,
                )
                for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
                return
            except Exception:
                pass

        if self.gemini_api_key:
            full = self.generate(prompt, max_tokens, temperature)
            words = full.split(" ")
            for i, word in enumerate(words):
                yield word + (" " if i < len(words) - 1 else "")
            return

        raise Exception("No AI client available for streaming")
