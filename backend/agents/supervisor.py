"""CareLink Multi-Agent Supervisor & StateGraph Orchestrator.

Orchestrates multi-agent clinical routing, execution, and grounding verification:
1. Classifies clinical query intent into one of 4 specialist domains:
   - `triage`: Acute triage, vitals deterioration, Manchester Triage System.
   - `risk_analyst`: Readmission risk, SHAP feature attributions, ML explainability.
   - `care_plan`: 4-part post-discharge recovery plan, follow-up scheduling.
   - `medication_safety`: Drug interactions (DDIs), contraindications, pharmacovigilance.
2. Enforces Confidence Floor (>= 0.60) with safe fallback to `triage`.
3. Runs the selected specialist agent.
4. Performs automated secondary medication safety screening if drugs are mentioned.
5. Invokes Citation Resolver to verify grounding and attach evidence badges.
"""
from typing import Any, Callable
import re
import logging
from .state import (
    CareLinkAgentState,
    CLINICAL_INTENTS,
    DEFAULT_INTENT,
    CONFIDENCE_FLOOR,
    create_initial_state,
    add_execution_step,
)
from .gateway import get_gateway
from .triage_agent import TriageAgent
from .risk_analyst_agent import RiskAnalystAgent
from .care_plan_agent import CarePlanAgent
from .medication_safety_agent import MedicationSafetyAgent, check_deterministic_ddi
from .citation_resolver import get_citation_resolver

logger = logging.getLogger("CareLink.Supervisor")


def classify_clinical_intent(query: str, gateway=None) -> tuple[str, float]:
    """Classify user query into specialist clinical intent with confidence score."""
    q_lower = query.lower()

    # Fast deterministic intent heuristics for zero-latency routing
    if any(k in q_lower for k in ["interaction", "contraindicat", "warfarin", "nsaid", "ibuprofen", "metformin", "drug safety", "side effect", "pill", "taking with"]):
        return "medication_safety", 0.95

    if any(k in q_lower for k in ["readmission", "risk factor", "shap", "xgboost", "predict", "cohort", "why is risk high", "probability"]):
        return "risk_analyst", 0.92

    if any(k in q_lower for k in ["care plan", "discharge plan", "diet", "lifestyle", "follow up schedule", "instructions after discharge", "self-monitoring", "recovery plan"]):
        return "care_plan", 0.90

    if any(k in q_lower for k in ["triage", "emergency", "urgent", "vital", "spo2", "fever", "chest pain", "shortness of breath", "blood pressure", "orthopnea"]):
        return "triage", 0.92

    # LLM-based intent classifier with structured JSON
    gateway = gateway or get_gateway()
    system_prompt = (
        "You are CareLink's Clinical Intent Classifier.\n"
        "Classify the query into EXACTLY one of: ['triage', 'risk_analyst', 'care_plan', 'medication_safety'].\n"
        "Return a JSON object: {\"intent\": \"<intent>\", \"confidence\": <float 0.0 to 1.0>}."
    )
    fallback_intent = {"intent": DEFAULT_INTENT, "confidence": 0.50}

    data, _ = gateway.invoke_json(
        system_prompt=system_prompt,
        user_prompt=f"Query: {query}",
        fallback_data=fallback_intent,
    )

    intent = data.get("intent", DEFAULT_INTENT).lower().strip()
    if intent not in CLINICAL_INTENTS:
        intent = DEFAULT_INTENT

    confidence = float(data.get("confidence", 0.50))
    return intent, round(confidence, 2)


class CareLinkSupervisor:
    """Multi-agent StateGraph supervisor and orchestrator."""

    def __init__(self):
        self.gateway = get_gateway()
        self.citation_resolver = get_citation_resolver()
        self.agents = {
            "triage": TriageAgent(),
            "risk_analyst": RiskAnalystAgent(),
            "care_plan": CarePlanAgent(),
            "medication_safety": MedicationSafetyAgent(),
        }

    def route(self, state: CareLinkAgentState) -> str:
        """Route to specialist agent with confidence floor fallback."""
        intent = state.get("intent", "")
        confidence = state.get("routing_confidence", 0.0)

        if intent in CLINICAL_INTENTS and confidence >= CONFIDENCE_FLOOR:
            return intent

        logger.info(f"Routing confidence ({confidence}) below floor ({CONFIDENCE_FLOOR}). Falling back to '{DEFAULT_INTENT}'.")
        return DEFAULT_INTENT

    def run(self, state: CareLinkAgentState) -> CareLinkAgentState:
        """Execute full multi-agent pipeline from intent classification to grounded verification."""
        user_query = state.get("user_query", "")

        # ── NODE 1: Supervisor Intent Classification ──
        intent, confidence = classify_clinical_intent(user_query, self.gateway)
        state["intent"] = intent
        state["routing_confidence"] = confidence

        # Apply routing rule
        routed_agent = self.route(state)
        state["routed_agent"] = routed_agent

        add_execution_step(
            state,
            agent_name="Supervisor",
            action="intent_classification",
            detail=f"Classified intent as '{intent}' (conf={confidence:.2f}). Routed to '{routed_agent}'.",
            metrics={"intent": intent, "confidence": confidence, "routed_agent": routed_agent},
        )

        # ── NODE 2: Specialist Agent Execution ──
        agent_instance = self.agents.get(routed_agent, self.agents[DEFAULT_INTENT])
        state = agent_instance.run(state)

        # ── NODE 3: Secondary Medication Safety Screen ──
        # If drugs are mentioned and we didn't already run medication_safety, perform safety screening
        meds = state.get("medications", [])
        if routed_agent != "medication_safety" and (meds or "taking" in user_query.lower() or "dose" in user_query.lower()):
            alerts, is_blocked = check_deterministic_ddi(meds, user_query, state.get("patient_demographics"))
            if alerts:
                state["medication_alerts"] = alerts
                state["is_blocked_by_safety"] = is_blocked
                add_execution_step(
                    state,
                    agent_name="Supervisor",
                    action="secondary_safety_screen",
                    detail=f"Secondary pharmacovigilance screen found {len(alerts)} alert(s) (Critical: {is_blocked}).",
                )
                if is_blocked:
                    state["agent_response"] = (
                        "⚠️ **CRITICAL PHARMACOVIGILANCE BLOCKER DETECTED**\n"
                        f"{alerts[0]['hazard']} Recommendation: {alerts[0]['recommendation']}\n\n"
                        + state["agent_response"]
                    )

        # ── NODE 4: Citation Resolver & Grounding Verification ──
        retrieved = state.get("retrieved_guidelines", [])
        verification = self.citation_resolver.verify_and_resolve(
            llm_text=state.get("agent_response", ""),
            retrieved_guidelines=retrieved,
        )

        state["agent_response"] = verification.enriched_text
        state["citations"] = verification.valid_citations
        state["evidence_badges"] = verification.evidence_badges
        state["grounding_fidelity"] = verification.grounding_fidelity
        state["is_grounded"] = verification.is_grounded

        add_execution_step(
            state,
            agent_name="Supervisor",
            action="grounding_verification",
            detail=(
                f"Verified grounding fidelity={verification.grounding_fidelity:.2f} "
                f"({len(verification.valid_citations)} citations, {len(verification.evidence_badges)} badges)."
            ),
            metrics={
                "fidelity": verification.grounding_fidelity,
                "is_grounded": verification.is_grounded,
                "valid_citations": verification.valid_citations,
                "hallucinations": verification.hallucinated_citations,
            }
        )

        return state


# Singleton instance
_supervisor_instance = None


def get_supervisor() -> CareLinkSupervisor:
    global _supervisor_instance
    if _supervisor_instance is None:
        _supervisor_instance = CareLinkSupervisor()
    return _supervisor_instance
