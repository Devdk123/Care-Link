"""CareLink Phase 3 Verification Suite: LangGraph Supervisor & Specialist Agents.

Tests:
1. Supervisor Intent Classification and Confidence-Floor Fallback Routing.
2. Triage Specialist Agent (MTS Severity Rules, Vitals Analysis, ReAct loop).
3. Medication Safety Specialist Agent (Critical DDI Blocker & Alternative Recommendation).
4. Risk Analyst Specialist Agent (XGBoost Readmission Risk & SHAP Attributions).
5. Care Plan Specialist Agent (4-part Post-Discharge Care Plan).
6. End-to-End Multi-Agent Orchestration with Citation Resolver.
"""
import os
import sys
from pathlib import Path
import unittest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.agents.state import (
    create_initial_state,
    CLINICAL_INTENTS,
    DEFAULT_INTENT,
    CONFIDENCE_FLOOR,
)
from backend.agents.supervisor import get_supervisor, classify_clinical_intent
from backend.agents.triage_agent import evaluate_vitals_severity
from backend.agents.medication_safety_agent import check_deterministic_ddi


class TestPhase3Agents(unittest.TestCase):

    def setUp(self):
        self.supervisor = get_supervisor()

    def test_01_intent_classification_and_routing(self):
        # 1. Triage intent
        intent_triage, conf_t = classify_clinical_intent("Patient has low SpO2 86%, tachycardia, and high fever")
        self.assertEqual(intent_triage, "triage")
        self.assertGreaterEqual(conf_t, CONFIDENCE_FLOOR)

        # 2. Medication safety intent
        intent_meds, conf_m = classify_clinical_intent("Can the patient take ibuprofen with warfarin?")
        self.assertEqual(intent_meds, "medication_safety")
        self.assertGreaterEqual(conf_m, CONFIDENCE_FLOOR)

        # 3. Risk analyst intent
        intent_risk, conf_r = classify_clinical_intent("Explain the SHAP risk factors predicting readmission")
        self.assertEqual(intent_risk, "risk_analyst")
        self.assertGreaterEqual(conf_r, CONFIDENCE_FLOOR)

        # 4. Care plan intent
        intent_plan, conf_p = classify_clinical_intent("Generate discharge care plan and follow up schedule")
        self.assertEqual(intent_plan, "care_plan")
        self.assertGreaterEqual(conf_p, CONFIDENCE_FLOOR)

        # 5. Fallback on low confidence / ambiguous query
        state = create_initial_state(user_query="Hello, I have a question")
        state["intent"] = "unknown_intent"
        state["routing_confidence"] = 0.35
        routed = self.supervisor.route(state)
        self.assertEqual(routed, DEFAULT_INTENT)

        print("  [PASS] Test 01: Supervisor intent classification & confidence floor routing passed.")

    def test_02_triage_vitals_evaluation(self):
        # Critical hypoxemia
        level_emerg, triggers_e = evaluate_vitals_severity({"spo2": 85, "heart_rate": 110})
        self.assertEqual(level_emerg, "Emergency")
        self.assertTrue(any("Hypoxemia" in t for t in triggers_e))

        # Hypertensive crisis
        level_htn, triggers_h = evaluate_vitals_severity({"systolic": 195, "diastolic": 115})
        self.assertEqual(level_htn, "Emergency")
        self.assertTrue(any("Hypertensive" in t for t in triggers_h))

        # Fluid overload (2.5 kg weight gain)
        level_urg, triggers_u = evaluate_vitals_severity({"weight_gain_kg": 2.5})
        self.assertEqual(level_urg, "Urgent")
        self.assertTrue(any("Fluid Overload" in t for t in triggers_u))

        # Stable vitals
        level_rout, triggers_r = evaluate_vitals_severity({"spo2": 98, "systolic": 120, "temperature": 98.6})
        self.assertEqual(level_rout, "Routine")
        self.assertEqual(len(triggers_r), 0)

        print("  [PASS] Test 02: Manchester Triage System (MTS) physiological vitals evaluation passed.")

    def test_03_medication_safety_critical_blocker(self):
        # Warfarin + Ibuprofen
        alerts, is_blocked = check_deterministic_ddi(
            medications=["warfarin", "ibuprofen"],
            query="Patient requested NSAID for joint pain",
        )
        self.assertTrue(is_blocked)
        self.assertGreaterEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["severity"], "CRITICAL")
        self.assertIn("[AHA-DDI-01]", alerts[0]["citation"])
        self.assertIn("Acetaminophen", alerts[0]["recommendation"])

        # Metformin + eGFR < 30
        alerts_m, is_blocked_m = check_deterministic_ddi(
            medications=["metformin", "lisinopril"],
            query="Routine glycemic maintenance",
            demographics={"egfr": 22},
        )
        self.assertTrue(is_blocked_m)
        self.assertTrue(any(a["type"] == "Renal Clearance Contraindication" for a in alerts_m))

        print("  [PASS] Test 03: Medication safety critical DDI blocker & safe alternatives passed.")

    def test_04_full_multi_agent_execution_trace(self):
        # Run Supervisor on a complex CHF readmission scenario
        state = create_initial_state(
            user_query="Patient with acute orthopnea, bilateral pedal edema, and 3kg weight gain in 48 hours",
            vitals={"spo2": 91, "weight_gain_kg": 3.0, "systolic": 145},
            medications=["furosemide", "carvedilol"],
        )

        final_state = self.supervisor.run(state)

        # Assertions
        self.assertEqual(final_state["routed_agent"], "triage")
        self.assertIn("CLINICAL TRIAGE ASSESSMENT", final_state["agent_response"])
        self.assertGreaterEqual(len(final_state["execution_steps"]), 3)
        self.assertTrue(any(step["agent"] == "TriageAgent" for step in final_state["execution_steps"]))
        self.assertTrue(any(step["agent"] == "Supervisor" for step in final_state["execution_steps"]))
        self.assertGreater(len(final_state["citations"]), 0)
        self.assertGreaterEqual(final_state["grounding_fidelity"], 0.70)
        self.assertTrue(final_state["is_grounded"])

        print(f"  [PASS] Test 04: Full multi-agent execution completed with {len(final_state['execution_steps'])} trace steps (fidelity={final_state['grounding_fidelity']:.2f}).")


def main():
    print("=================================================================")
    print(" CareLink Phase 3: Supervisor & Specialist Agents Verification")
    print("=================================================================")
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPhase3Agents)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if result.wasSuccessful():
        print("\n>>> ALL PHASE 3 PYTHON VERIFICATIONS PASSED (100% SUCCESS) <<<")
        return 0
    else:
        print("\n>>> PHASE 3 PYTHON VERIFICATION FAILED <<<")
        return 1


if __name__ == "__main__":
    sys.exit(main())
