"""CareLink Resilient LLM Inference Gateway.

Provides a unified, fault-tolerant model gateway supporting:
1. Google Gemini (gemini-2.5-flash / gemini-1.5-flash) as primary reasoning engine.
2. Groq (llama-3.3-70b-versatile / llama-3.1-8b-instant / gpt-oss-120b) as zero-latency failover engine.
3. Deterministic Mock / Clinical Fallback provider for unit tests and offline resiliency.

Features:
- Automated failover on HTTP 429 (RateLimit), quota limits, or 503 timeouts.
- Telemetry & Cost Accounting: tracks input/output tokens, latency, cost in USD.
- JSON-mode extraction with markdown block defense.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
import json
import os
from pathlib import Path
import re
import ssl
import time
from typing import Any, Callable
import urllib.request
import urllib.error

def get_ssl_context():
    try:
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
        return ctx
    except Exception:
        pass
    try:
        return ssl.create_default_context()
    except Exception:
        return ssl._create_unverified_context()

# Fallback permissive context for local development if system certificates missing
_FALLBACK_SSL_CTX = ssl._create_unverified_context()

# Load environment variables
try:
    from dotenv import load_dotenv
    root_env = Path(__file__).resolve().parents[2] / ".env"
    if root_env.exists():
        load_dotenv(root_env)
except ImportError:
    pass


@dataclass
class ModelMetrics:
    provider: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: float = 0.0
    cost_usd: float = 0.0
    failover_occurred: bool = False
    failover_reason: str = ""


PRICING_MAP = {
    "gemini-2.5-flash": {"input": 0.075, "output": 0.30},
    "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
    "llama-3.3-70b-versatile": {"input": 0.59, "output": 0.79},
    "llama-3.1-8b-instant": {"input": 0.05, "output": 0.08},
    "openai/gpt-oss-120b": {"input": 0.60, "output": 0.90},
}


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    rate = PRICING_MAP.get(model, {"input": 0.20, "output": 0.60})
    input_cost = (input_tokens / 1_000_000.0) * rate["input"]
    output_cost = (output_tokens / 1_000_000.0) * rate["output"]
    return round(input_cost + output_cost, 6)


def extract_json_from_text(text: str) -> dict:
    """Safely extract a JSON dict from raw model output."""
    stripped = text.strip()
    # 1. Direct JSON parse
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # 2. Markdown fenced code block ```json ... ```
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", stripped, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # 3. Outermost curly braces
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = stripped[start : end + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Failed to parse valid JSON from model response: {text[:200]}...")


class LLMProvider(ABC):
    @abstractmethod
    def invoke(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        json_mode: bool = False,
    ) -> tuple[str, ModelMetrics]:
        pass


class GeminiProvider(LLMProvider):
    """Google Gemini REST Provider."""

    DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

    def invoke(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        json_mode: bool = False,
    ) -> tuple[str, ModelMetrics]:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("Missing GEMINI_API_KEY")

        target_model = model or self.DEFAULT_MODEL
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={api_key}"

        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "maxOutputTokens": 800,
                "temperature": 0.2,
                "responseMimeType": "application/json" if json_mode else "text/plain",
            },
        }

        est_in = max(1, len(system_prompt + " " + user_prompt) // 4)
        req_data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=req_data,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "CareLink-Clinical-Agent/2.5"
            },
            method="POST",
        )

        start_time = time.time()
        try:
            try:
                resp = urllib.request.urlopen(req, timeout=8.0, context=get_ssl_context())
            except urllib.error.URLError as ssl_err:
                resp = urllib.request.urlopen(req, timeout=8.0, context=_FALLBACK_SSL_CTX)
            with resp:
                resp_text = resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Gemini HTTP {exc.code}: {err_body[:120]}")
        except Exception as exc:
            raise RuntimeError(f"Gemini connection error: {str(exc)}")

        latency_ms = (time.time() - start_time) * 1000.0
        data = json.loads(resp_text)
        generated_text = ""
        candidates = data.get("candidates") or []
        if candidates and "content" in candidates[0]:
            parts = candidates[0]["content"].get("parts") or []
            if parts and "text" in parts[0]:
                generated_text = parts[0]["text"].strip()

        est_out = max(1, len(generated_text) // 4)
        metrics = ModelMetrics(
            provider="gemini",
            model=target_model,
            input_tokens=est_in,
            output_tokens=est_out,
            latency_ms=round(latency_ms, 2),
            cost_usd=calculate_cost(target_model, est_in, est_out),
        )
        return generated_text, metrics


class GroqProvider(LLMProvider):
    """Groq Cloud API Provider (OpenAI-compatible chat completions)."""

    DEFAULT_MODEL = os.environ.get("GROQ_REASONING_MODEL", "openai/gpt-oss-120b")

    def invoke(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        json_mode: bool = False,
    ) -> tuple[str, ModelMetrics]:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("Missing GROQ_API_KEY")

        target_model = model or self.DEFAULT_MODEL
        url = "https://api.groq.com/openai/v1/chat/completions"

        payload = {
            "model": target_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": 800,
            "temperature": 0.2,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        est_in = max(1, len(system_prompt + " " + user_prompt) // 4)
        req_data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=req_data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "CareLink-Clinical-Agent/2.5"
            },
            method="POST",
        )

        start_time = time.time()
        try:
            try:
                resp = urllib.request.urlopen(req, timeout=8.0, context=get_ssl_context())
            except urllib.error.URLError:
                resp = urllib.request.urlopen(req, timeout=8.0, context=_FALLBACK_SSL_CTX)
            with resp:
                resp_text = resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Groq HTTP {exc.code}: {err_body[:120]}")
        except Exception as exc:
            raise RuntimeError(f"Groq connection error: {str(exc)}")

        latency_ms = (time.time() - start_time) * 1000.0
        data = json.loads(resp_text)
        generated_text = ""
        choices = data.get("choices") or []
        if choices and "message" in choices[0]:
            generated_text = choices[0]["message"].get("content", "").strip()

        est_out = max(1, len(generated_text) // 4)
        metrics = ModelMetrics(
            provider="groq",
            model=target_model,
            input_tokens=est_in,
            output_tokens=est_out,
            latency_ms=round(latency_ms, 2),
            cost_usd=calculate_cost(target_model, est_in, est_out),
        )
        return generated_text, metrics


class MockLLMProvider(LLMProvider):
    """Deterministic Mock Provider for offline testing and static fallback."""

    def __init__(self, static_response: str = '{"status": "safe", "recommendation": "Follow clinical guidelines."}'):
        self.static_response = static_response

    def invoke(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        json_mode: bool = False,
    ) -> tuple[str, ModelMetrics]:
        metrics = ModelMetrics(
            provider="mock",
            model="deterministic-fallback-v1",
            input_tokens=30,
            output_tokens=20,
            latency_ms=1.2,
            cost_usd=0.0,
        )
        return self.static_response, metrics


class LLMGateway:
    """Central inference orchestrator with dual-model failover."""

    def __init__(self):
        self._providers = {
            "gemini": GeminiProvider(),
            "groq": GroqProvider(),
            "mock": MockLLMProvider(),
        }
        self.telemetry_history: list[ModelMetrics] = []

    def get_provider(self, name: str) -> LLMProvider:
        return self._providers.get(name.lower(), self._providers["mock"])

    def invoke(
        self,
        system_prompt: str,
        user_prompt: str,
        json_mode: bool = False,
        primary_provider: str = "gemini",
        fallback_provider: str = "groq",
        model: str | None = None,
    ) -> tuple[str, ModelMetrics]:
        primary = self.get_provider(primary_provider)
        try:
            text, metrics = primary.invoke(
                system_prompt, user_prompt, model=model, json_mode=json_mode
            )
            self.telemetry_history.append(metrics)
            return text, metrics
        except Exception as primary_err:
            # Automatic Failover Trigger
            reason = str(primary_err)
            secondary = self.get_provider(fallback_provider)
            try:
                text, metrics = secondary.invoke(
                    system_prompt, user_prompt, json_mode=json_mode
                )
                metrics.failover_occurred = True
                metrics.failover_reason = reason
                self.telemetry_history.append(metrics)
                return text, metrics
            except Exception as secondary_err:
                # Tertiary Fallback
                fallback_mock = self.get_provider("mock")
                text, metrics = fallback_mock.invoke(
                    system_prompt, user_prompt, json_mode=json_mode
                )
                metrics.failover_occurred = True
                metrics.failover_reason = f"Primary ({reason}) | Secondary ({str(secondary_err)})"
                self.telemetry_history.append(metrics)
                return text, metrics

    def invoke_json(
        self,
        system_prompt: str,
        user_prompt: str,
        fallback_data: dict | None = None,
        primary_provider: str = "gemini",
        fallback_provider: str = "groq",
        model: str | None = None,
    ) -> tuple[dict, ModelMetrics]:
        raw_text, metrics = self.invoke(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            json_mode=True,
            primary_provider=primary_provider,
            fallback_provider=fallback_provider,
            model=model,
        )
        try:
            parsed = extract_json_from_text(raw_text)
            return parsed, metrics
        except Exception:
            return fallback_data or {}, metrics


# Global singleton
_GLOBAL_GATEWAY = None


def get_gateway() -> LLMGateway:
    global _GLOBAL_GATEWAY
    if _GLOBAL_GATEWAY is None:
        _GLOBAL_GATEWAY = LLMGateway()
    return _GLOBAL_GATEWAY
