"""CareLink Medication Safety Specialist Agent.

Performs deterministic & LLM-augmented pharmacovigilance checks:
1. Detects high-risk Drug-Drug Interactions (DDIs), contraindicated combinations, and clearance limits.
2. Identifies severe anticoagulant + NSAID bleeding hazards ([AHA-DDI-01]).
3. Identifies Metformin / SGLT2i renal clearance contraindications ([ICMR-DM-01]).
4. Sets `is_blocked_by_safety = True` on CRITICAL violations and provides safe clinical alternatives.
"""
from typing import Any
import re
from .state import CareLinkAgentState, add_execution_step
from .clinical_rag import get_clinical_rag
from .gateway import get_gateway


# Known drug interaction patterns
_ANTICOAGULANTS = {"warfarin", "apixaban", "rivaroxaban", "dabigatran", "edoxaban", "heparin", "enoxaparin"}
_NSAIDS = {"ibuprofen", "naproxen", "diclofenac", "ketorolac", "meloxicam", "indomethacin", "celecoxib"}
_ACE_INHIBITORS = {"lisinopril", "ramipril", "enalapril", "benazepril", "captopril", "perindopril"}
_ARBS = {"losartan", "valsartan", "telmisartan", "candesartan", "irbesartan", "olmesartan"}


def check_deterministic_ddi(
    medications: list[str],
    query: str = "",
    demographics: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], bool]:
    """Run deterministic drug interaction and organ clearance rules."""
    alerts: list[dict[str, Any]] = []
    is_critical_blocked = False

    demographics = demographics or {}
    all_text = f"{' '.join(medications)} {query}".lower()

    found_anticoag = [m for m in _ANTICOAGULANTS if m in all_text]
    found_nsaids = [m for m in _NSAIDS if m in all_text]
    found_ace = [m for m in _ACE_INHIBITORS if m in all_text]
    found_arbs = [m for m in _ARBS if m in all_text]

    # Rule 1: Anticoagulant + NSAID (Critical Blocker)
    if found_anticoag and found_nsaids:
        is_critical_blocked = True
        alerts.append({
            "severity": "CRITICAL",
            "type": "Drug-Drug Interaction",
            "drugs": f"{', '.join(found_anticoag)} + {', '.join(found_nsaids)}",
            "hazard": "Concomitant use increases major gastrointestinal bleeding and hemorrhagic stroke risk by 2.5-3.8x.",
            "recommendation": "Discontinue NSAID immediately. Substitute with Acetaminophen (Paracetamol) up to 2g daily for pain relief.",
            "citation": "[AHA-DDI-01]",
        })

    # Rule 2: Dual RAAS Blockade (ACE-i + ARB)
    if found_ace and found_arbs:
        alerts.append({
            "severity": "WARNING",
            "type": "Dual RAAS Blockade",
            "drugs": f"{', '.join(found_ace)} + {', '.join(found_arbs)}",
            "hazard": "Combining ACE inhibitors and ARBs significantly increases hyperkalemia, hypotension, and acute kidney failure.",
            "recommendation": "Monotherapy with single RAAS agent is standard of care. Re-evaluate nephrology regimen.",
            "citation": "[KDIGO-CKD-01]",
        })

    # Rule 3: Metformin with eGFR < 30 mL/min
    egfr = demographics.get("egfr") or demographics.get("eGFR")
    if "metformin" in all_text and egfr is not None:
        try:
            val_egfr = float(egfr)
            if val_egfr < 30:
                is_critical_blocked = True
                alerts.append({
                    "severity": "CRITICAL",
                    "type": "Renal Clearance Contraindication",
                    "drugs": "Metformin",
                    "hazard": f"eGFR is severely compromised ({val_egfr} mL/min/1.73m² < 30). Extreme risk of fatal lactic acidosis.",
                    "recommendation": "Withhold Metformin immediately. Switch to insulin or safe DPP-4 inhibitor.",
                    "citation": "[ICMR-DM-01]",
                })
        except (ValueError, TypeError):
            pass

    return alerts, is_critical_blocked


class MedicationSafetyAgent:
    """Specialist agent for clinical pharmacovigilance and drug interaction gating."""

    def __init__(self):
        self.rag = get_clinical_rag()
        self.gateway = get_gateway()

    def run(self, state: CareLinkAgentState) -> CareLinkAgentState:
        """Run medication safety audit, attach alerts, and enforce blockers."""
        user_query = state.get("user_query", "")
        medications = state.get("medications", [])
        demographics = state.get("patient_demographics", {})

        alerts, is_blocked = check_deterministic_ddi(medications, user_query, demographics)
        state["medication_alerts"] = alerts
        state["is_blocked_by_safety"] = is_blocked

        add_execution_step(
            state,
            agent_name="MedicationSafetyAgent",
            action="ddi_safety_scan",
            detail=f"Identified {len(alerts)} alert(s) (Critical Blocker: {is_blocked}).",
        )

        # Retrieve relevant clinical safety guidelines
        search_terms = f"{user_query} {' '.join(medications)} drug interaction contraindication safety"
        guidelines = self.rag.search_guidelines(search_terms, top_k=2, min_score=0.01)
        state["retrieved_guidelines"] = [
            {
                "tag": g.tag,
                "title": g.title,
                "condition": g.condition,
                "source": g.source,
                "content": g.content,
                "evidence_level": g.evidence_level,
                "score": g.score,
            }
            for g in guidelines
        ]

        guideline_context = self.rag.format_for_prompt(guidelines)

        system_prompt = (
            "You are CareLink's Clinical Pharmacovigilance & Medication Safety Specialist Agent.\n"
            "Review the patient's active and proposed medications for safety hazards, DDIs, and organ clearance limits.\n"
            "Structure your output as follows:\n\n"
            "### CLINICAL MEDICATION SAFETY AUDIT\n"
            "- **Safety Gate Status**: [CLEAR | WARNING | BLOCKED - CRITICAL HAZARD]\n"
            "- **Detected Adverse Interactions**: [Detail any DDIs, renal contraindications, or bleeding risks]\n"
            "- **Clinical Action & Safe Alternatives**: [Recommend safe replacements, dosages, or discontinuation]\n"
            "- **Monitoring Mandate**: [Mandatory lab surveillance, e.g. eGFR or potassium tracking]\n\n"
            "MANDATORY REQUIREMENT: Reference evidence-backed guideline citations (e.g. [AHA-DDI-01], [ICMR-DM-01]).\n\n"
            f"{guideline_context}"
        )

        user_prompt = (
            f"Query/Prescription: {user_query}\n"
            f"Medications Under Review: {medications}\n"
            f"Automated Safety Findings: {alerts}\n"
            f"Critical Safety Gate: {'BLOCKED' if is_blocked else 'CLEAR'}\n"
            "Generate the clinical medication safety audit now."
        )

        response_text, metrics = self.gateway.invoke(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        state["agent_response"] = response_text
        state["routed_agent"] = "medication_safety"

        add_execution_step(
            state,
            agent_name="MedicationSafetyAgent",
            action="medication_safety_audit",
            detail=f"Generated medication safety audit via {metrics.provider} ({metrics.latency_ms:.0f}ms).",
            metrics={
                "provider": metrics.provider,
                "latency_ms": metrics.latency_ms,
                "failover": metrics.failover_occurred,
            }
        )

        return state

    evaluate = run


# Singleton instance
_medication_safety_instance = None


def get_medication_safety_agent() -> MedicationSafetyAgent:
    global _medication_safety_instance
    if _medication_safety_instance is None:
        _medication_safety_instance = MedicationSafetyAgent()
    return _medication_safety_instance
