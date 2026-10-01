"""
CareLink Clinical RAGAS Evaluation Engine (Python)
Evaluates multi-agent clinical responses on three standardized RAGAS metrics:
1. Faithfulness (Claims verified against retrieved guidelines)
2. Context Precision (Relevance and ranking of retrieved clinical guidelines)
3. Answer Relevancy (Alignment of clinical response to physician query)
"""

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from backend.agents.citation_resolver import verify_and_resolve_citations
from backend.agents.clinical_rag import CLINICAL_GUIDELINES, search_clinical_guidelines

RAGAS_PASS_THRESHOLD = 0.70
RAGAS_EXCELLENT_THRESHOLD = 0.85


@dataclass
class ClinicalBenchmarkCase:
    id: str
    name: str
    query: str
    expected_guideline_tags: List[str]
    expected_urgency_or_action: str
    vitals: Dict[str, float] = field(default_factory=dict)
    medications: List[str] = field(default_factory=list)


CLINICAL_BENCHMARK_CASES: List[ClinicalBenchmarkCase] = [
    ClinicalBenchmarkCase(
        id="case_hf_decomp",
        name="Acute Heart Failure Decompensation",
        query="Patient with severe dyspnea, orthopnea, bilateral lower extremity edema, and BNP 1400 pg/mL.",
        expected_guideline_tags=["ICMR-HF-01", "AHA-DDI-01"],
        expected_urgency_or_action="Urgent",
        vitals={"hr": 108, "sbp": 165, "dbp": 98, "spo2": 89, "rr": 28, "temp": 98.6},
        medications=["Furosemide 40mg", "Lisinopril 10mg"],
    ),
    ClinicalBenchmarkCase(
        id="case_warfarin_nsaid",
        name="Warfarin & NSAID Severe Gastrointestinal Hemorrhage Risk",
        query="Patient on therapeutic Warfarin 5mg daily for atrial fibrillation asks to take Ibuprofen 800mg TID for acute knee arthritis pain.",
        expected_guideline_tags=["AHA-DDI-01"],
        expected_urgency_or_action="CRITICAL",
        vitals={"hr": 74, "sbp": 128, "dbp": 82, "spo2": 98, "rr": 14, "temp": 98.4},
        medications=["Warfarin 5mg", "Ibuprofen 800mg"],
    ),
    ClinicalBenchmarkCase(
        id="case_metformin_ckd",
        name="Metformin Lactic Acidosis in Advanced Renal Impairment",
        query="Type 2 diabetic patient with chronic kidney disease eGFR 24 mL/min/1.73m2 currently prescribed Metformin 1000mg BID.",
        expected_guideline_tags=["KDIGO-CKD-01", "ICMR-DM-01"],
        expected_urgency_or_action="CRITICAL",
        vitals={"hr": 80, "sbp": 135, "dbp": 85, "spo2": 97, "rr": 16, "temp": 98.2},
        medications=["Metformin 1000mg"],
    ),
    ClinicalBenchmarkCase(
        id="case_pediatric_fever",
        name="Pediatric High Pyrexia Danger Signs",
        query="18-month old infant with fever of 39.8C, extreme lethargy, refusal of fluids, and grunting respiration.",
        expected_guideline_tags=["IAP-PEDS-01"],
        expected_urgency_or_action="Emergency",
        vitals={"hr": 165, "sbp": 90, "dbp": 55, "spo2": 93, "rr": 52, "temp": 39.8},
        medications=["Paracetamol drop"],
    ),
    ClinicalBenchmarkCase(
        id="case_copd_hypoxia",
        name="Severe COPD Exacerbation with Hypercapnic Respiratory Failure",
        query="Elderly patient with chronic COPD presenting with severe respiratory fatigue, drowsiness, and SpO2 84% on room air.",
        expected_guideline_tags=["WHO-RESP-01", "NICE-CG-01"],
        expected_urgency_or_action="Emergency",
        vitals={"hr": 118, "sbp": 142, "dbp": 88, "spo2": 84, "rr": 34, "temp": 98.9},
        medications=["Salbutamol inhaler", "Tiotropium"],
    ),
]


def _extract_field(item: Any, key: str, default: str = "") -> str:
    if isinstance(item, dict):
        val = item.get(key, default)
        if val is None and key == "snippet":
            val = item.get("content", default)
        return str(val) if val is not None else default
    val = getattr(item, key, default)
    if val is None and key == "snippet":
        val = getattr(item, "content", default)
    return str(val) if val is not None else default


def evaluate_ragas_metrics(
    query: str,
    answer: str,
    retrieved_guidelines: List[Any],
    expected_guideline_tags: Optional[List[str]] = None,
) -> Dict[str, Any]:
    expected_tags = expected_guideline_tags or []

    # 1. Faithfulness Metric
    citation_result = verify_and_resolve_citations(answer, retrieved_guidelines=retrieved_guidelines)
    citation_fidelity = citation_result.grounding_fidelity

    # Clean and split claims
    lines = [l.strip() for l in re.split(r"\n|\.\s+", answer) if len(l.strip()) > 25]
    claims = [l for l in lines if not l.startswith("#") and not l.startswith("-")]

    combined_context = " ".join(
        f"{_extract_field(g, 'tag')} {_extract_field(g, 'title')} {_extract_field(g, 'content')} {_extract_field(g, 'snippet')}"
        for g in retrieved_guidelines
    ).lower()

    supported_count = 0
    unsupported_claims: List[str] = []

    for claim in claims:
        words = [w for w in re.sub(r"[^a-z0-9 ]", "", claim.lower()).split() if len(w) > 4]
        if not words:
            continue
        matching = [w for w in words if w in combined_context]
        if len(matching) / len(words) >= 0.35 and citation_result.is_grounded:
            supported_count += 1
        elif len(matching) / len(words) >= 0.50:
            supported_count += 1
        else:
            unsupported_claims.append(claim)

    claim_ratio = (supported_count / len(claims)) if claims else 1.0
    faithfulness = round(0.5 * citation_fidelity + 0.5 * claim_ratio, 3)

    # 2. Context Precision Metric
    retrieved_tags = [_extract_field(g, "tag") for g in retrieved_guidelines if _extract_field(g, "tag")]
    clean_expected = {t.strip("[]").strip().upper() for t in expected_tags}
    relevant_count = 0
    if clean_expected:
        for t in retrieved_tags:
            clean_t = t.strip("[]").strip().upper()
            if clean_t in clean_expected:
                relevant_count += 1
    else:
        relevant_count = len(retrieved_tags)

    denom = len(clean_expected) if clean_expected else len(retrieved_tags) or 1
    context_precision = round(min(1.0, relevant_count / denom), 3) if retrieved_tags else 0.5

    # 3. Answer Relevancy Metric
    query_words = [w for w in re.sub(r"[^a-z0-9 ]", "", query.lower()).split() if len(w) > 3]
    answer_lower = answer.lower()
    matched_q = [w for w in query_words if w in answer_lower]
    answer_relevancy = (
        round(min(1.0, (len(matched_q) / len(query_words)) * 1.25), 3)
        if query_words
        else 0.85
    )

    # 4. Composite RAGAS Score
    composite_score = round(
        0.4 * faithfulness + 0.3 * context_precision + 0.3 * answer_relevancy, 3
    )

    is_passed = composite_score >= RAGAS_PASS_THRESHOLD
    if composite_score >= RAGAS_EXCELLENT_THRESHOLD:
        verdict = "EXCELLENT"
    elif composite_score >= RAGAS_PASS_THRESHOLD:
        verdict = "PASS"
    elif composite_score >= 0.50:
        verdict = "AMBER"
    else:
        verdict = "FAIL"

    return {
        "faithfulness": faithfulness,
        "context_precision": context_precision,
        "answer_relevancy": answer_relevancy,
        "composite_score": composite_score,
        "is_passed": is_passed,
        "verdict": verdict,
        "details": {
            "total_claims_checked": len(claims),
            "supported_claims_count": supported_count,
            "unsupported_claims": unsupported_claims[:3],
            "retrieved_guideline_tags": retrieved_tags,
            "relevant_guideline_count": relevant_count,
            "hallucination_risk": "NONE" if not unsupported_claims else "LOW" if len(unsupported_claims) <= 1 else "HIGH",
        },
    }
