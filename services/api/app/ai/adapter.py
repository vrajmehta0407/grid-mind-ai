"""Swappable AI Adapter: Google Gemini -> OpenRouter -> Groq -> Anthropic -> Deterministic Mock.

Rules:
- All PII must be redacted BEFORE calling any provider.
- LLMs only extract bill fields or phrase explanations; they NEVER compute money or unit math.
- In pytest or offline environments, gracefully falls back to the mock/deterministic adapter.
"""

from __future__ import annotations

import base64
import json
import os
import re
from typing import Any

import httpx

from app.core.config import settings
from app.core.pii import redact_pii


class AIAdapterResponse:
    def __init__(self, text: str, provider_used: str, is_mock: bool = False) -> None:
        self.text = text
        self.provider_used = provider_used
        self.is_mock = is_mock


class SwappableAIAdapter:
    """Unified interface with automatic fallback across Gemini, OpenRouter, Groq, Anthropic, and Mock."""

    def _provider_order(self) -> list[str]:
        pref = (settings.ai_provider or "auto").lower()
        if pref == "mock":
            return ["mock"]
        if pref in {"gemini", "openrouter", "groq", "anthropic"}:
            others = [p for p in ["gemini", "openrouter", "groq", "anthropic"] if p != pref]
            return [pref, *others, "mock"]
        return ["gemini", "openrouter", "groq", "anthropic", "mock"]

    def active_provider_info(self) -> dict[str, Any]:
        for name in self._provider_order():
            if name == "gemini" and settings.gemini_api_key:
                return {"provider": "gemini", "model": settings.gemini_model, "configured": True}
            if name == "openrouter" and settings.openrouter_api_key:
                return {"provider": "openrouter", "model": settings.openrouter_model, "configured": True}
            if name == "groq" and settings.groq_api_key:
                return {"provider": "groq", "model": settings.groq_model, "configured": True}
            if name == "anthropic" and settings.anthropic_api_key:
                return {"provider": "anthropic", "model": settings.anthropic_model, "configured": True}
        return {"provider": "mock", "model": "deterministic-local-v1", "configured": False}

    def _should_skip_network(self) -> bool:
        return bool(os.environ.get("PYTEST_CURRENT_TEST")) or (
            os.environ.get("GRIDMIND_OFFLINE_AI") == "1"
        )

    def complete_json(
        self,
        prompt: str,
        image_bytes: bytes | None = None,
        media_type: str | None = None,
        timeout_s: float = 15.0,
    ) -> tuple[dict[str, Any] | None, str]:
        """Call the configured AI provider chain for structured JSON extraction, redacting PII first."""
        safe_prompt = redact_pii(prompt).redacted_text
        if self._should_skip_network():
            return None, "mock"

        for provider in self._provider_order():
            if provider == "mock":
                return None, "mock"
            try:
                raw_text: str | None = None
                if provider == "gemini" and settings.gemini_api_key:
                    raw_text = self._call_gemini(safe_prompt, image_bytes, media_type, timeout_s)
                elif provider == "openrouter" and settings.openrouter_api_key:
                    raw_text = self._call_openrouter(safe_prompt, image_bytes, media_type, timeout_s)
                elif provider == "groq" and settings.groq_api_key:
                    raw_text = self._call_groq(safe_prompt, timeout_s)
                elif provider == "anthropic" and settings.anthropic_api_key:
                    raw_text = self._call_anthropic(safe_prompt, image_bytes, media_type, timeout_s)

                if raw_text:
                    match = re.search(r"\{[\s\S]*\}", raw_text)
                    if match:
                        return json.loads(match.group(0)), provider
            except Exception:
                continue

        return None, "mock"

    def complete_text(
        self,
        system_prompt: str,
        user_prompt: str,
        timeout_s: float = 8.0,
    ) -> AIAdapterResponse:
        """Generate plain-language explanation from tool-grounded numbers only."""
        safe_user = redact_pii(user_prompt).redacted_text
        if self._should_skip_network():
            return AIAdapterResponse(text="", provider_used="mock", is_mock=True)

        full_prompt = f"{system_prompt}\n\n{safe_user}"
        for provider in self._provider_order():
            if provider == "mock":
                break
            try:
                out: str | None = None
                if provider == "gemini" and settings.gemini_api_key:
                    out = self._call_gemini(full_prompt, None, None, timeout_s)
                elif provider == "openrouter" and settings.openrouter_api_key:
                    out = self._call_openrouter(full_prompt, None, None, timeout_s)
                elif provider == "groq" and settings.groq_api_key:
                    out = self._call_groq(full_prompt, timeout_s)
                elif provider == "anthropic" and settings.anthropic_api_key:
                    out = self._call_anthropic(full_prompt, None, None, timeout_s)
                if out and out.strip():
                    return AIAdapterResponse(text=out.strip(), provider_used=provider, is_mock=False)
            except Exception:
                continue

        return AIAdapterResponse(text="", provider_used="mock", is_mock=True)

    def _call_gemini(
        self,
        prompt: str,
        image_bytes: bytes | None,
        media_type: str | None,
        timeout_s: float,
    ) -> str | None:
        parts: list[dict[str, Any]] = [{"text": prompt}]
        if image_bytes and media_type in {"image/png", "image/jpeg", "image/webp"}:
            parts.append(
                {
                    "inline_data": {
                        "mime_type": media_type,
                        "data": base64.b64encode(image_bytes).decode("ascii"),
                    }
                }
            )
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
        )
        with httpx.Client(timeout=timeout_s) as client:
            resp = client.post(url, json={"contents": [{"parts": parts}]})
            if resp.status_code != 200:
                return None
            candidates = resp.json().get("candidates", [])
            if candidates:
                c_parts = candidates[0].get("content", {}).get("parts", [])
                return "".join(p.get("text", "") for p in c_parts)
        return None

    def _call_openrouter(
        self,
        prompt: str,
        image_bytes: bytes | None,
        media_type: str | None,
        timeout_s: float,
    ) -> str | None:
        content: list[dict[str, Any]] | str
        if image_bytes and media_type in {"image/png", "image/jpeg", "image/webp"}:
            b64 = base64.b64encode(image_bytes).decode("ascii")
            content = [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{b64}"}},
            ]
        else:
            content = prompt

        with httpx.Client(timeout=timeout_s) as client:
            resp = client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "GridMind AI",
                },
                json={
                    "model": settings.openrouter_model,
                    "messages": [{"role": "user", "content": content}],
                    "max_tokens": 700,
                    "temperature": 0.1,
                },
            )
            if resp.status_code != 200:
                return None
            choices = resp.json().get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content")
        return None

    def _call_groq(self, prompt: str, timeout_s: float) -> str | None:
        with httpx.Client(timeout=timeout_s) as client:
            resp = client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json={
                    "model": settings.groq_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 700,
                    "temperature": 0.1,
                },
            )
            if resp.status_code != 200:
                return None
            choices = resp.json().get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content")
        return None

    def _call_anthropic(
        self,
        prompt: str,
        image_bytes: bytes | None,
        media_type: str | None,
        timeout_s: float,
    ) -> str | None:
        content: list[dict[str, Any]] = []
        if image_bytes and media_type in {"image/png", "image/jpeg", "image/webp"}:
            content.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": base64.b64encode(image_bytes).decode("ascii"),
                    },
                }
            )
        content.append({"type": "text", "text": prompt})
        with httpx.Client(timeout=timeout_s) as client:
            resp = client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.anthropic_api_key or "",
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": settings.anthropic_model,
                    "max_tokens": 700,
                    "messages": [{"role": "user", "content": content}],
                },
            )
            if resp.status_code != 200:
                return None
            blocks = resp.json().get("content", [])
            return "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
        return None


ai_adapter = SwappableAIAdapter()

