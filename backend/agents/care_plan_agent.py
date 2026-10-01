"""CareLink Care Plan Specialist Agent.

Generates the 4-part post-discharge clinical care plan:
1. Medication Regimen & Titration Schedule.
2. Clinical Follow-Up & Specialist Review Timing.
3. Diet, Fluid, and Daily Self-Monitoring Protocols.
4. Emergency Red Flag Warning Signs requiring immediate hospital return.
All recommendations are strictly grounded in ICMR, WHO, NICE, and AHA protocols with bracketed citations.
"""
from typing import Any
from .state import CareLinkAgentState, add_execution_step
from .clinical_rag import get_clinical_rag
from .gateway import get_gateway


class CarePlanAgent:
    """Specialist agent for personalized post-discharge care plan generation."""

    def __init__(self):
        self.rag = get_clinical_rag()
        self.gateway = get_gateway()

    def run(self, state: CareLinkAgentState) -> CareLinkAgentState:
        """Generate structured 4-part post-discharge care plan."""
        user_query = state.get("user_query", "")
        demographics = state.get("patient_demographics", {})
        vitals = state.get("vitals", {})
        medications = state.get("medications", [])

        # Retrieve relevant clinical care guidelines
        search_terms = f"{user_query} discharge care plan follow up {' '.join(medications)}"
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
        add_execution_step(
            state,
            agent_name="CarePlanAgent",
            action="clinical_rag_retrieval",
            detail=f"Retrieved {len(guidelines)} guideline(s) for care plan: {', '.join([g.tag for g in guidelines]) or 'None'}",
        )

        system_prompt = (
            "You are CareLink's Post-Discharge Care Plan Specialist Agent.\n"
            "Generate an authoritative, patient-tailored 4-part discharge plan formatted strictly as:\n\n"
            "### POST-DISCHARGE CLINICAL CARE PLAN\n"
            "#### 1. Medication Regimen & Titration Protocol\n"
            "- List prescribed medications, instructions, and adjustments (cite guidelines, e.g. [ICMR-DM-01]).\n\n"
            "#### 2. Follow-Up & Clinical Review Schedule\n"
            "- Specify mandatory follow-up appointments and lab re-evaluations (e.g. 7-10 day review [ICMR-HF-01]).\n\n"
            "#### 3. Dietary, Fluid & Self-Monitoring Mandates\n"
            "- Detail daily monitoring protocols (e.g. daily morning weight tracking, sodium/fluid restrictions).\n\n"
            "#### 4. Emergency Red Flag Warning Signs\n"
            "- Define unambiguous red flag triggers that require immediate emergency department escalation.\n\n"
            "MANDATORY REQUIREMENT: Every section must contain valid bracketed guideline citations (e.g. [ICMR-HF-01], [NICE-SURG-01]).\n\n"
            f"{guideline_context}"
        )

        user_prompt = (
            f"Patient Discharge Request: {user_query}\n"
            f"Active Medications: {', '.join(medications) if medications else 'None specified'}\n"
            f"Vitals at Discharge: {vitals}\n"
            f"Demographics / Diagnoses: {demographics}\n"
            "Generate the comprehensive 4-part post-discharge care plan now."
        )

        response_text, metrics = self.gateway.invoke(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        state["agent_response"] = response_text
        state["routed_agent"] = "care_plan"

        add_execution_step(
            state,
            agent_name="CarePlanAgent",
            action="care_plan_synthesis",
            detail=f"Synthesized care plan via {metrics.provider} ({metrics.latency_ms:.0f}ms).",
            metrics={
                "provider": metrics.provider,
                "latency_ms": metrics.latency_ms,
                "failover": metrics.failover_occurred,
            }
        )

        return state
