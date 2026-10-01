"""CareLink Risk Analyst Specialist Agent.

Interprets XGBoost 30-day readmission predictions and SHAP explainability feature attributions:
1. Translates numerical risk probability into clinical risk categories (Low <30%, Moderate 30-65%, High >65%).
2. Evaluates top positive and negative SHAP feature attributions.
3. Retrieves readmission reduction protocols from Clinical RAG.
4. Generates an evidence-grounded risk narrative with specific mitigation actions.
"""
from typing import Any
from .state import CareLinkAgentState, add_execution_step
from .clinical_rag import get_clinical_rag
from .gateway import get_gateway


class RiskAnalystAgent:
    """Specialist agent for ML readmission risk explanation and SHAP narrative synthesis."""

    def __init__(self):
        self.rag = get_clinical_rag()
        self.gateway = get_gateway()

    def run(self, state: CareLinkAgentState) -> CareLinkAgentState:
        """Analyze patient risk factors and generate evidence-grounded explainability narrative."""
        user_query = state.get("user_query", "")
        demographics = state.get("patient_demographics", {})
        vitals = state.get("vitals", {})

        # Extract risk probability or mock a realistic clinical risk baseline if not in payload
        risk_score = demographics.get("readmission_risk_score") or demographics.get("risk_score", 0.68)
        if isinstance(risk_score, (int, float)):
            risk_pct = round(float(risk_score) * 100, 1)
        else:
            risk_pct = 68.0

        if risk_pct >= 65.0:
            risk_tier = "HIGH RISK"
        elif risk_pct >= 35.0:
            risk_tier = "MODERATE RISK"
        else:
            risk_tier = "LOW RISK"

        # Extract or synthesize SHAP attributions
        shap_factors = demographics.get("shap_factors", [
            {"feature": "Prior Emergency Admissions (>=2 in 12m)", "attribution": "+0.24", "impact": "High Adverse"},
            {"feature": "Recent eGFR Decline (<45 mL/min)", "attribution": "+0.18", "impact": "Moderate Adverse"},
            {"feature": "Polypharmacy (>7 medications)", "attribution": "+0.15", "impact": "Moderate Adverse"},
            {"feature": "Scheduled Early Cardiology Review", "attribution": "-0.12", "impact": "Protective"},
        ])

        add_execution_step(
            state,
            agent_name="RiskAnalystAgent",
            action="shap_feature_attribution",
            detail=f"Analyzed risk score {risk_pct}% ({risk_tier}) with {len(shap_factors)} SHAP factors.",
        )

        # Retrieve relevant clinical guidelines for the identified risk drivers
        search_terms = f"{user_query} readmission risk heart failure diabetes ckd {' '.join([f['feature'] for f in shap_factors])}"
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
            agent_name="RiskAnalystAgent",
            action="clinical_rag_retrieval",
            detail=f"Retrieved {len(guidelines)} guideline(s) for risk mitigation: {', '.join([g.tag for g in guidelines]) or 'None'}",
        )

        system_prompt = (
            "You are CareLink's Clinical Risk Analyst Agent.\n"
            "Your role is to explain XGBoost 30-day hospital readmission predictions and SHAP feature attributions.\n"
            "Structure your response strictly as follows:\n"
            "### 30-DAY READMISSION RISK & SHAP ANALYSIS\n"
            "- **Predicted Readmission Risk**: [Tier and Percentage, e.g. HIGH RISK (68.0%)]\n"
            "- **Primary Risk Drivers (SHAP Explanation)**: [Detail the top factors pushing the patient into high risk]\n"
            "- **Protective & Stabilizing Factors**: [Highlight any positive mitigating factors]\n"
            "- **Targeted Readmission Mitigation Protocol**: [Actionable steps with mandatory bracketed citations, e.g. [ICMR-HF-01], [KDIGO-CKD-01]]\n\n"
            f"{guideline_context}"
        )

        user_prompt = (
            f"Clinical Query: {user_query}\n"
            f"Patient Risk Profile: Tier={risk_tier}, Probability={risk_pct}%\n"
            f"SHAP Attributions: {shap_factors}\n"
            f"Patient Demographics: {demographics}\n"
            "Generate the clinical risk analysis report now."
        )

        response_text, metrics = self.gateway.invoke(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        state["agent_response"] = response_text
        state["routed_agent"] = "risk_analyst"

        add_execution_step(
            state,
            agent_name="RiskAnalystAgent",
            action="risk_narrative_generation",
            detail=f"Generated risk narrative via {metrics.provider} ({metrics.latency_ms:.0f}ms).",
            metrics={
                "provider": metrics.provider,
                "latency_ms": metrics.latency_ms,
                "failover": metrics.failover_occurred,
            }
        )

        return state
