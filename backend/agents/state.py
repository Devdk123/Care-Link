"""CareLink Agent State Definition.

Defines the single source of truth for the multi-agent state shape passed between
the Supervisor, Triage Agent, Risk Analyst, Care Plan Generator, Medication Safety Checker,
and Citation Resolver.
"""
from dataclasses import dataclass, field
from typing import Any, TypedDict, Optional
import datetime
import uuid


# Legitimate clinical intents for supervisor routing
CLINICAL_INTENTS = ["triage", "risk_analyst", "care_plan", "medication_safety"]
DEFAULT_INTENT = "triage"
CONFIDENCE_FLOOR = 0.60


class CareLinkAgentState(TypedDict, total=False):
    """LangGraph / Multi-agent state dictionary."""
    user_query: str
    patient_id: Optional[str]
    patient_demographics: dict[str, Any]
    vitals: dict[str, Any]
    medications: list[str]
    intent: str  # Classifier guess (e.g. "triage", "risk_analyst")
    routing_confidence: float  # 0.0 to 1.0
    routed_agent: str  # Agent node that actually executed
    retrieved_guidelines: list[dict[str, Any]]
    agent_response: str
    citations: list[str]
    evidence_badges: list[dict[str, Any]]
    grounding_fidelity: float  # 0.0 to 1.0
    is_grounded: bool
    medication_alerts: list[dict[str, Any]]
    is_blocked_by_safety: bool
    execution_steps: list[dict[str, Any]]
    session_id: str
    memory_context: list[str]
    messages: list[dict[str, Any]]


def create_initial_state(
    user_query: str,
    patient_id: Optional[str] = None,
    patient_demographics: Optional[dict[str, Any]] = None,
    vitals: Optional[dict[str, Any]] = None,
    medications: Optional[list[str]] = None,
    session_id: Optional[str] = None,
    memory_context: Optional[list[str]] = None,
) -> CareLinkAgentState:
    """Instantiate a clean initial state dictionary for multi-agent execution."""
    return {
        "user_query": user_query,
        "patient_id": patient_id,
        "patient_demographics": patient_demographics or {},
        "vitals": vitals or {},
        "medications": medications or [],
        "intent": "",
        "routing_confidence": 0.0,
        "routed_agent": "",
        "retrieved_guidelines": [],
        "agent_response": "",
        "citations": [],
        "evidence_badges": [],
        "grounding_fidelity": 1.0,
        "is_grounded": True,
        "medication_alerts": [],
        "is_blocked_by_safety": False,
        "execution_steps": [],
        "session_id": session_id or str(uuid.uuid4())[:8],
        "memory_context": memory_context or [],
        "messages": [],
    }


def add_execution_step(
    state: CareLinkAgentState,
    agent_name: str,
    action: str,
    detail: str,
    metrics: Optional[dict[str, Any]] = None,
) -> None:
    """Record an agent step in the telemetry trace for the frontend Agent Cockpit."""
    if "execution_steps" not in state or state["execution_steps"] is None:
        state["execution_steps"] = []

    state["execution_steps"].append({
        "step_id": len(state["execution_steps"]) + 1,
        "agent": agent_name,
        "action": action,
        "detail": detail,
        "metrics": metrics or {},
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    })
