"""Test suite for Dual-Model Failover Engine (backend/agents/gateway.py)."""
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from agents.gateway import (
    LLMGateway,
    GeminiProvider,
    GroqProvider,
    MockLLMProvider,
    extract_json_from_text,
    calculate_cost,
)


def test_json_extraction():
    """Verify that JSON extraction handles markdown fences and edge cases."""
    text_with_fences = """Here is the clinical output:
```json
{
  "triage": "Urgent",
  "confidence": 0.88,
  "rationale": "High heart rate and SpO2 91%"
}
```
Thank you."""
    parsed = extract_json_from_text(text_with_fences)
    assert parsed["triage"] == "Urgent"
    assert parsed["confidence"] == 0.88


def test_mock_provider():
    """Test deterministic mock provider."""
    mock = MockLLMProvider('{"status": "ok", "agent": "mock"}')
    text, metrics = mock.invoke("sys", "user", json_mode=True)
    assert metrics.provider == "mock"
    assert "ok" in text


def test_failover_when_primary_fails():
    """Test that when Gemini fails (or key is invalid), gateway auto-switches to Groq."""
    gateway = LLMGateway()
    # Force primary Gemini provider to throw
    class FailingGemini(GeminiProvider):
        def invoke(self, *args, **kwargs):
            raise RuntimeError("Gemini HTTP 429: Rate limit quota exceeded (SIMULATED)")

    gateway._providers["gemini"] = FailingGemini()

    system_prompt = "You are a healthcare triage AI. Return JSON with key 'status'."
    user_prompt = "Patient has chest pain and shortness of breath."

    result, metrics = gateway.invoke_json(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        fallback_data={"status": "fallback"},
        primary_provider="gemini",
        fallback_provider="groq",
    )

    print(f"\n[Test Result] Provider: {metrics.provider}")
    print(f"[Test Result] Model: {metrics.model}")
    print(f"[Test Result] Failover occurred: {metrics.failover_occurred}")
    print(f"[Test Result] Failover reason: {metrics.failover_reason}")
    print(f"[Test Result] Latency: {metrics.latency_ms} ms")
    print(f"[Test Result] Output: {result}")

    assert metrics.failover_occurred is True
    assert "Rate limit quota exceeded" in metrics.failover_reason
    assert metrics.provider in ("groq", "mock")
    assert isinstance(result, dict)


if __name__ == "__main__":
    print("--- Running Test 1: JSON Extraction ---")
    test_json_extraction()
    print("PASS: JSON Extraction verified.")

    print("\n--- Running Test 2: Mock Provider ---")
    test_mock_provider()
    print("PASS: Mock Provider verified.")

    print("\n--- Running Test 3: Dual-Model Failover (Simulated 429 -> Groq) ---")
    test_failover_when_primary_fails()
    print("PASS: Dual-Model Failover verified!")
