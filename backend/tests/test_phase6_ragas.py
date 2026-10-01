"""
Phase 6: Clinical RAGAS Observability & Evaluation Test Suite (Python)
Evaluates multi-agent clinical responses on three standardized RAGAS metrics:
1. Faithfulness (Grounding of medical assertions in clinical guidelines)
2. Context Precision (Ranking and retrieval accuracy of guideline tags)
3. Answer Relevancy (Alignment of generated answer to physician query)
"""

import sys
import os
from pathlib import Path

# Add project root to sys.path
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.agents.eval_ragas import (
    evaluate_ragas_metrics,
    CLINICAL_BENCHMARK_CASES,
    RAGAS_PASS_THRESHOLD,
    RAGAS_EXCELLENT_THRESHOLD
)
from backend.agents.clinical_rag import search_clinical_guidelines
from backend.agents.observability import (
    RunTrace,
    record_run_trace,
    get_recent_traces,
    get_observability_summary
)


def test_ragas_single_grounded_case():
    print("[TEST 1/4] Evaluating RAGAS metrics on verified grounded clinical answer...")
    query = "Patient with acute decompensated heart failure, severe bilateral edema, and elevated blood pressure."
    answer = (
        "According to [ICMR-HF-01], patients discharged following acute decompensated heart failure "
        "must undergo daily morning dry-weight monitoring and clinical review within 7 to 10 days. "
        "Sudden weight gain exceeding 2.0 kg indicates fluid retention requiring immediate diuretic escalation. "
        "Per [AHA-HTN-01], target blood pressure should be strictly monitored under GDMT protocols."
    )
    retrieved = search_clinical_guidelines(query, limit=3)
    result = evaluate_ragas_metrics(
        query=query,
        answer=answer,
        retrieved_guidelines=retrieved,
        expected_guideline_tags=["ICMR-HF-01", "AHA-HTN-01"]
    )

    print(f"  - Faithfulness:      {result['faithfulness']}")
    print(f"  - Context Precision: {result['context_precision']}")
    print(f"  - Answer Relevancy:  {result['answer_relevancy']}")
    print(f"  - Composite Score:   {result['composite_score']}")
    print(f"  - Verdict:           {result['verdict']}")

    assert result["faithfulness"] >= 0.70, f"Faithfulness {result['faithfulness']} < 0.70"
    assert result["is_passed"] is True, f"Expected RAGAS pass, got {result['verdict']}"
    assert result["details"]["hallucination_risk"] in ("NONE", "LOW")
    print("  [PASS] Single grounded case meets RAGAS acceptance threshold.")


def test_ragas_hallucinated_case_penalty():
    print("[TEST 2/4] Testing RAGAS hallucination penalty on ungrounded dangerous answer...")
    query = "Patient on therapeutic Warfarin asks to take Ibuprofen 800mg TID."
    # Fabricated dangerous advice with no citations
    ungrounded_answer = (
        "It is totally fine to take high dose Ibuprofen 800mg TID along with Warfarin. "
        "There are no known bleeding interactions between NSAIDs and anticoagulants. "
        "Feel free to take aspirin as well if the joint pain continues."
    )
    retrieved = search_clinical_guidelines(query, limit=3)
    result = evaluate_ragas_metrics(
        query=query,
        answer=ungrounded_answer,
        retrieved_guidelines=retrieved,
        expected_guideline_tags=["AHA-DDI-01"]
    )

    print(f"  - Faithfulness:    {result['faithfulness']}")
    print(f"  - Composite Score: {result['composite_score']}")
    print(f"  - Verdict:         {result['verdict']}")
    print(f"  - Hallucination:   {result['details']['hallucination_risk']}")

    # Ungrounded answer without citations should fail RAGAS threshold
    assert result["faithfulness"] < 0.70, "Ungrounded answer should have low faithfulness"
    assert result["composite_score"] < RAGAS_PASS_THRESHOLD, "Ungrounded answer should fail RAGAS"
    print("  [PASS] Hallucination penalty correctly applied to unverified advice.")


def test_ragas_benchmark_suite():
    print("[TEST 3/4] Running RAGAS benchmark across standard clinical cases...")
    passed_cases = 0
    total_cases = len(CLINICAL_BENCHMARK_CASES)

    for case in CLINICAL_BENCHMARK_CASES:
        retrieved = search_clinical_guidelines(case.query, limit=3)
        tag = f"[{case.expected_guideline_tags[0].strip('[]')}]" if case.expected_guideline_tags else "[WHO-01]"
        top_guideline_content = retrieved[0].content if retrieved else "Immediate medical protocol compliance."
        mock_response = (
            f"Clinical assessment for {case.query}: According to {tag}, recommended clinical action is {case.expected_urgency_or_action}. "
            f"Key protocol requirements state: {top_guideline_content[:180]}. "
            f"Close clinical monitoring required per {tag}."
        )

        res = evaluate_ragas_metrics(
            query=case.query,
            answer=mock_response,
            retrieved_guidelines=retrieved,
            expected_guideline_tags=case.expected_guideline_tags
        )

        print(f"  - Case '{case.name[:35]}...': Score={res['composite_score']} ({res['verdict']})")
        if res["is_passed"]:
            passed_cases += 1

    pass_rate = passed_cases / total_cases
    print(f"  - Benchmark Pass Rate: {passed_cases}/{total_cases} ({pass_rate * 100:.1f}%)")
    assert pass_rate >= 0.80, f"Benchmark pass rate {pass_rate} < 0.80 target"
    print("  [PASS] RAGAS clinical benchmark suite achieved target pass rate.")


def test_observability_trace_recording():
    print("[TEST 4/4] Testing LangSmith-compatible run trace recording and summary...")
    trace = RunTrace(
        trace_id="trace_test_phase6_001",
        root_query="Assess readmission risk for patient with heart failure and diabetes",
        routed_agent="risk_analyst",
        routing_confidence=0.94,
        total_duration_ms=480.5,
        token_usage={"prompt_tokens": 120, "completion_tokens": 85, "total_tokens": 205},
        provider_used="gemini",
        grounding_score=0.92,
        citations=["[ICMR-HF-01]"],
        is_safety_blocked=False,
        spans=[
            {"span_id": "s1", "name": "intent_routing", "duration_ms": 120, "status": "SUCCESS"},
            {"span_id": "s2", "name": "shap_explanation", "duration_ms": 360, "status": "SUCCESS"}
        ],
        created_at="2026-09-28T22:50:00Z"
    )

    record_run_trace(trace)
    recent = get_recent_traces(10)
    assert len(recent) > 0, "No traces retrieved from store"
    assert recent[0]["trace_id"] == "trace_test_phase6_001"

    summary = get_observability_summary()
    print(f"  - Total Recorded Runs: {summary['total_runs']}")
    print(f"  - Avg Latency:        {summary['avg_latency_ms']} ms")
    print(f"  - Avg Grounding:      {summary['avg_grounding_score']}")
    print(f"  - Provider Breakdown: {summary['provider_distribution']}")

    assert summary["total_runs"] >= 1
    assert "gemini" in summary["provider_distribution"]
    print("  [PASS] Observability trace recorder and summary verified.")


if __name__ == "__main__":
    print("================================================================")
    print("CareLink Phase 6: Clinical RAGAS & Observability Test Suite")
    print("================================================================")
    test_ragas_single_grounded_case()
    test_ragas_hallucinated_case_penalty()
    test_ragas_benchmark_suite()
    test_observability_trace_recording()
    print("================================================================")
    print("ALL PHASE 6 RAGAS & OBSERVABILITY TESTS PASSED [PASS]")
    print("================================================================")
