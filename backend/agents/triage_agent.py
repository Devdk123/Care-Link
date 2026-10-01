"""CareLink Clinical Triage Agent.

Executes ReAct triage loop:
1. Analyzes physiological vitals against Manchester Triage System (MTS) & ESI criteria.
2. Identifies critical red flags (hypoxemia, sepsis qSOFA, acute fluid overload).
3. Retrieves relevant evidence-based clinical guidelines via Clinical RAG.
4. Generates an evidence-grounded clinical urgency assessment with mandatory bracketed citations.
"""
from typing import Any
import re
from .state import CareLinkAgentState, add_execution_step
from .clinical_rag import get_clinical_rag
from .gateway import get_gateway


def evaluate_vitals_severity(vitals: dict[str, Any], query: str = "") -> tuple[str, list[str]]:
    """Determine clinical triage severity using Manchester Triage System (MTS) rules."""
    flags: list[str] = []
    level = "Routine"

    q_lower = query.lower()

    # 1. SpO2 check
    spo2 = vitals.get("spo2") or vitals.get("oxygen_saturation")
    if spo2 is not None:
        try:
            val = float(spo2)
            if val < 88:
                flags.append(f"Critical Hypoxemia (SpO2: {val}% < 88%)")
                level = "Emergency"
            elif val < 92:
                flags.append(f"Mild-to-moderate Hypoxemia (SpO2: {val}%)")
                if level != "Emergency":
                    level = "Urgent"
        except (ValueError, TypeError):
            pass

    # 2. Blood Pressure check
    sbp = vitals.get("systolic") or vitals.get("sbp")
    dbp = vitals.get("diastolic") or vitals.get("dbp")
    if sbp is not None:
        try:
            val_s = float(sbp)
            if val_s >= 180:
                flags.append(f"Hypertensive Crisis (Systolic: {val_s} mmHg >= 180)")
                if level != "Emergency":
                    level = "Emergency"
            elif val_s <= 90:
                flags.append(f"Severe Hypotension / Shock (Systolic: {val_s} mmHg <= 90)")
                level = "Emergency"
        except (ValueError, TypeError):
            pass

    # 3. Temperature check (handles both °F and °C)
    temp = vitals.get("temperature") or vitals.get("temp")
    if temp is not None:
        try:
            val_t = float(temp)
            is_severe = val_t > 102.2 if val_t > 45.0 else val_t > 39.0
            is_febrile = val_t > 100.4 if val_t > 45.0 else val_t > 38.0
            if is_severe:
                flags.append(f"High Pyrexia / Severe Fever ({val_t}°)")
                if level != "Emergency":
                    level = "Urgent"
            elif is_febrile:
                flags.append(f"Febrile State ({val_t}°)")
                if level == "Routine":
                    level = "Urgent"
        except (ValueError, TypeError):
            pass

    # 4. Fluid Retention / Weight Gain
    weight_gain = vitals.get("weight_gain_kg") or vitals.get("weight_change")
    if weight_gain is not None:
        try:
            val_w = float(weight_gain)
            if val_w >= 2.0:
                flags.append(f"Acute Fluid Overload (+{val_w} kg in <= 48 hrs)")
                if level != "Emergency":
                    level = "Urgent"
        except (ValueError, TypeError):
            pass

    # 5. Symptom keywords from text
    if "chest pain" in q_lower or "unconscious" in q_lower or "cyanosis" in q_lower or "septic shock" in q_lower:
        flags.append("High-acuity symptom keywords detected")
        level = "Emergency"
    elif "orthopnea" in q_lower or "swelling" in q_lower or "pus" in q_lower or "shortness of breath" in q_lower:
        flags.append("Decompensation / infection warning symptoms detected")
        if level == "Routine":
            level = "Urgent"

    return level, flags


class TriageAgent:
    """Specialist agent for clinical risk triage and severity classification."""

    def __init__(self):
        self.rag = get_clinical_rag()
        self.gateway = get_gateway()

    def run(self, state: CareLinkAgentState) -> CareLinkAgentState:
        """Execute clinical triage ReAct loop."""
        user_query = state.get("user_query", "")
        vitals = state.get("vitals", {})

        # Step 1: Physiological vitals evaluation
        severity_level, triggers = evaluate_vitals_severity(vitals, user_query)
        add_execution_step(
            state,
            agent_name="TriageAgent",
            action="vitals_evaluation",
            detail=f"Classified severity as '{severity_level}' with {len(triggers)} trigger(s): {', '.join(triggers) or 'None'}",
        )

        # Step 2: Clinical RAG retrieval
        search_query = f"{user_query} {' '.join(triggers)}"
        retrieved_hits = self.rag.search_guidelines(search_query, top_k=2, min_score=0.01)
        state["retrieved_guidelines"] = [
            {
                "tag": h.tag,
                "title": h.title,
                "condition": h.condition,
                "source": h.source,
                "content": h.content,
                "evidence_level": h.evidence_level,
                "score": h.score,
            }
            for h in retrieved_hits
        ]

        guideline_context = self.rag.format_for_prompt(retrieved_hits)
        add_execution_step(
            state,
            agent_name="TriageAgent",
            action="clinical_rag_retrieval",
            detail=f"Retrieved {len(retrieved_hits)} guideline(s): {', '.join([h.tag for h in retrieved_hits]) or 'None'}",
        )

        # Step 3: LLM Synthesis with Failover Gateway
        system_prompt = (
            "You are CareLink's Clinical Triage Specialist Agent.\n"
            "Evaluate patient status using the Manchester Triage System (MTS).\n"
            "Your output must follow this format:\n"
            "### CLINICAL TRIAGE ASSESSMENT\n"
            "- **Triage Urgency Level**: [Routine | Urgent | Emergency]\n"
            "- **Physiological Triggers**: [Summarize key triggers]\n"
            "- **Immediate Clinical Action**: [Step-by-step instructions grounded in clinical guidelines]\n"
            "- **Escalation Window**: [e.g. Immediate ER transfer, 24-hr clinic review, or routine 7-day review]\n\n"
            "MANDATORY REQUIREMENT: Whenever referencing clinical recommendations, embed the appropriate bracketed citation "
            "(e.g. [ICMR-HF-01], [WHO-SEPSIS-01], [AHA-HTN-01]). Do NOT fabricate citations.\n\n"
            f"{guideline_context}"
        )

        user_prompt = (
            f"Patient Query/Notes: {user_query}\n"
            f"Vitals: {vitals}\n"
            f"Automated MTS Assessment: {severity_level} (Triggers: {triggers})\n"
            "Generate the clinical triage assessment now."
        )

        response_text, metrics = self.gateway.invoke(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        # Ensure model included the automated severity if it omitted it
        if "Triage Urgency Level" not in response_text:
            response_text = f"**Triage Urgency Level**: {severity_level}\n\n" + response_text

        state["agent_response"] = response_text
        state["routed_agent"] = "triage"

        add_execution_step(
            state,
            agent_name="TriageAgent",
            action="triage_generation",
            detail=f"Generated clinical triage recommendation via {metrics.provider} ({metrics.latency_ms:.0f}ms).",
            metrics={
                "provider": metrics.provider,
                "latency_ms": metrics.latency_ms,
                "failover": metrics.failover_occurred,
            }
        )

        return state
