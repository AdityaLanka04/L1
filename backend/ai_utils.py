import base64
import logging
import json
import time
from typing import Optional

import requests
from activity_context import get_activity_context
from activity_logger import log_ai_tokens
from ai_usage import extract_usage_from_openai_like, extract_usage_from_gemini_payload

logger = logging.getLogger(__name__)


class NoVisionProviderError(Exception):
    """Raised when no vision-capable provider is configured."""


class UnifiedAIClient:

    def __init__(
        self,
        gemini_client=None,
        groq_client=None,
        gemini_model: str = "gemini-2.0-flash",
        groq_model: str = "llama-3.3-70b-versatile",
        gemini_api_key: str = None,
        openai_compat_api_key: str = None,
        openai_compat_base_url: str = "https://api.openai.com/v1",
        openai_compat_model: str = "gpt-4o-mini",
    ):
        self.gemini_module = gemini_client
        self.groq_client = groq_client
        self.gemini_model = gemini_model
        self.groq_model = groq_model
        self.gemini_api_key = gemini_api_key
        self.openai_compat_api_key = openai_compat_api_key
        self.openai_compat_base_url = openai_compat_base_url.rstrip("/")
        self.openai_compat_model = openai_compat_model

        if openai_compat_api_key and not gemini_client and not groq_client:
            self.gemini_client = None
            self.primary_ai = "openai_compat"
        elif gemini_client:
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
            raise ValueError("At least one AI client (Gemini, Groq, or OpenAI-compat) must be provided")

    def generate(
        self,
        prompt: str,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        use_cache: bool = False,
        conversation_id: str = None,
    ) -> str:
        try:
            if self.primary_ai == "openai_compat" and self.openai_compat_api_key:
                return self._call_openai_compat(prompt, max_tokens, temperature)
            elif self.primary_ai == "gemini" and self.gemini_api_key:
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
                    usage = extract_usage_from_gemini_payload(data)
                    self._log_usage(usage, model=self.gemini_model, provider="gemini")
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
        usage = extract_usage_from_openai_like(resp)
        self._log_usage(usage, model=self.groq_model, provider="groq")
        return resp.choices[0].message.content.strip()

    def _call_openai_compat(self, prompt: str, max_tokens: int, temperature: float) -> str:
        """Call any OpenAI-compatible REST API (sk-* key format)."""
        url = f"{self.openai_compat_base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.openai_compat_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.openai_compat_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        for attempt in range(3):
            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=90)
                if resp.status_code == 200:
                    data = resp.json()
                    usage = extract_usage_from_openai_like(data)
                    self._log_usage(usage, model=self.openai_compat_model, provider="hs_context")
                    return data["choices"][0]["message"]["content"].strip()
                if resp.status_code == 429:
                    time.sleep(2 ** attempt)
                    continue
                raise Exception(f"HS context AI error {resp.status_code}: {resp.text[:200]}")
            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError):
                if attempt == 2:
                    raise
                time.sleep(2)
        raise Exception("HS context AI request failed after retries")

    def _fallback(self, prompt: str, max_tokens: int, temperature: float) -> str:
        if self.primary_ai == "openai_compat":
            if self.gemini_api_key:
                return self._call_gemini(prompt, max_tokens, temperature)
            if self.groq_client:
                return self._call_groq(prompt, max_tokens, temperature)
        if self.primary_ai == "gemini" and self.groq_client:
            return self._call_groq(prompt, max_tokens, temperature)
        if self.primary_ai == "groq" and self.gemini_api_key:
            return self._call_gemini(prompt, max_tokens, temperature)
        raise Exception("No fallback AI client available")

    def generate_with_images(
        self,
        prompt: str,
        images: list[dict],  # [{"data": bytes, "mime_type": str, "filename": str}]
        max_tokens: int = 2000,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate a vision response.  Provider priority:
          1. Gemini (always multimodal, preferred even when primary_ai=groq)
          2. OpenAI-compat (GPT-4o / Claude etc.)
          3. Raises NoVisionProviderError — caller decides the fallback UX.
        Never routes images through a text-only LLM to avoid "I can't see images" replies.
        """
        if not images:
            return self.generate(prompt, max_tokens, temperature)

        # 1 — Gemini is always vision-capable; use it first regardless of primary_ai
        if self.gemini_api_key:
            try:
                return self._call_gemini_vision(prompt, images, max_tokens, temperature)
            except Exception as e:
                logger.warning(f"Gemini vision failed: {e}")

        # 2 — OpenAI-compat (e.g. GPT-4o)
        if self.primary_ai == "openai_compat" and self.openai_compat_api_key:
            try:
                return self._call_openai_compat_vision(prompt, images, max_tokens, temperature)
            except Exception as e:
                logger.warning(f"OpenAI-compat vision failed: {e}")

        # 3 — No vision provider available; raise so the endpoint can return a clean UX message
        raise NoVisionProviderError("No vision-capable AI provider is configured")

    def _call_gemini_vision(
        self,
        prompt: str,
        images: list[dict],
        max_tokens: int,
        temperature: float,
    ) -> str:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.gemini_model}:generateContent?key={self.gemini_api_key}"
        )
        parts: list = [{"text": prompt}]
        for img in images:
            parts.append({
                "inlineData": {
                    "mimeType": img["mime_type"],
                    "data": base64.b64encode(img["data"]).decode("utf-8"),
                }
            })
        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        for attempt in range(3):
            try:
                resp = requests.post(url, json=payload, timeout=90)
                if resp.status_code == 200:
                    data = resp.json()
                    usage = extract_usage_from_gemini_payload(data)
                    self._log_usage(usage, model=self.gemini_model, provider="gemini_vision")
                    if "candidates" in data and data["candidates"]:
                        return data["candidates"][0]["content"]["parts"][0]["text"]
                    raise Exception("Gemini vision response has no candidates")
                if resp.status_code == 429 or "quota" in resp.text.lower():
                    raise Exception("Gemini quota exceeded")
                if attempt == 2:
                    raise Exception(f"Gemini vision API error: {resp.status_code} — {resp.text[:200]}")
                time.sleep(1)
            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError):
                if attempt == 2:
                    raise
                time.sleep(2)
        raise Exception("Gemini vision request failed after retries")

    def _call_openai_compat_vision(
        self,
        prompt: str,
        images: list[dict],
        max_tokens: int,
        temperature: float,
    ) -> str:
        url = f"{self.openai_compat_base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.openai_compat_api_key}",
            "Content-Type": "application/json",
        }
        content: list = [{"type": "text", "text": prompt}]
        for img in images:
            b64 = base64.b64encode(img["data"]).decode("utf-8")
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:{img['mime_type']};base64,{b64}", "detail": "high"},
            })
        payload = {
            "model": self.openai_compat_model,
            "messages": [{"role": "user", "content": content}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        for attempt in range(3):
            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=120)
                if resp.status_code == 200:
                    data = resp.json()
                    usage = extract_usage_from_openai_like(data)
                    self._log_usage(usage, model=self.openai_compat_model, provider="openai_vision")
                    return data["choices"][0]["message"]["content"].strip()
                if resp.status_code == 429:
                    time.sleep(2 ** attempt)
                    continue
                raise Exception(f"OpenAI vision error {resp.status_code}: {resp.text[:200]}")
            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError):
                if attempt == 2:
                    raise
                time.sleep(2)
        raise Exception("OpenAI vision request failed after retries")

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

    def _log_usage(self, usage, model: str, provider: str):
        if not usage:
            return
        try:
            ctx = get_activity_context()
            if not ctx:
                return
            log_ai_tokens(
                user_id=ctx.get("user_id"),
                tool_name=ctx.get("tool_name", "ai_unknown"),
                prompt_tokens=usage.get("prompt_tokens", 0),
                completion_tokens=usage.get("completion_tokens", 0),
                total_tokens=usage.get("total_tokens", 0),
                model=model,
                metadata={
                    "provider": provider,
                    "endpoint": ctx.get("endpoint"),
                    "method": ctx.get("method"),
                    "source_action": ctx.get("action"),
                },
            )
        except Exception as e:
            logger.warning(f"Failed to log AI usage: {e}")
