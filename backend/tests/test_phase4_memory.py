"""CareLink Phase 4 Verification Suite: Long-Term Memory (Mem0) & Active Learning Feedback.

Tests:
1. Patient-Scoped Memory Storage & Recall (Mem0 & Local Fallback).
2. Memory Context Prompt Injection Formatting.
3. Clinician Feedback & Override Classification.
4. Moving Override Rate Drift Alert (>15% safety threshold).
5. Active Learning Fine-Tuning Retraining Payload Generation.
"""
import os
import sys
from pathlib import Path
import unittest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.agents.memory import get_memory_service
from backend.agents.feedback_agent import get_feedback_agent, OVERRIDE_DRIFT_THRESHOLD


class TestPhase4MemoryAndFeedback(unittest.TestCase):

    def setUp(self):
        self.memory = get_memory_service()
        self.feedback = get_feedback_agent()

    def test_01_patient_memory_storage_and_recall(self):
        pid = "test_patient_phase4_01"
        self.memory.remember(
            patient_id=pid,
            memory_text="Known severe anaphylaxis to Cephalosporins and Penicillins",
            category="allergies",
        )
        self.memory.remember(
            patient_id=pid,
            memory_text="History of recurrent HF admissions; baseline EF is 32%",
            category="chronic_conditions",
        )

        recalled_allergies = self.memory.recall(pid, query="allergy cephalosporin", limit=2)
        self.assertGreater(len(recalled_allergies), 0)
        self.assertTrue(any("anaphylaxis" in m.lower() for m in recalled_allergies))

        all_memories = self.memory.get_patient_memories(pid)
        self.assertGreaterEqual(len(all_memories), 2)
        print("  [PASS] Test 01: Patient-scoped memory storage and recall passed.")

    def test_02_memory_context_formatting(self):
        memories = [
            "Severe anaphylaxis to Penicillin",
            "Baseline eGFR 42 mL/min",
            "Target dry weight 72.0 kg",
        ]
        context = self.memory.format_memory_context(memories)
        self.assertIn("-- PATIENT LONG-TERM CLINICAL MEMORY", context)
        self.assertIn("Penicillin", context)
        self.assertIn("eGFR 42", context)
        print("  [PASS] Test 02: Memory context prompt block formatting passed.")

    def test_03_clinician_feedback_and_override_detection(self):
        # 1. Clinician approval
        rec_app = self.feedback.record_feedback(
            interaction_id="int_test_1",
            patient_id="pt_100",
            agent_type="triage",
            suggested_action="Routine 7-day review",
            clinician_action="Approved",
        )
        self.assertFalse(rec_app.is_override)

        # 2. Clinician override
        rec_over = self.feedback.record_feedback(
            interaction_id="int_test_2",
            patient_id="pt_101",
            agent_type="triage",
            suggested_action="Routine 7-day review",
            clinician_action="Urgent same-day cardiology transfer",
            override_reason="Borderline ejection fraction and acute orthopnea",
        )
        self.assertTrue(rec_over.is_override)
        self.assertIn("orthopnea", rec_over.override_reason)
        print("  [PASS] Test 03: Clinician feedback logging & override detection passed.")

    def test_04_override_rate_drift_alert(self):
        # Log reviews to test threshold
        # 1 approval, 4 overrides -> 4/5 = 80% > 15%
        for i in range(4):
            self.feedback.record_feedback(
                interaction_id=f"int_drift_{i}",
                patient_id=f"pt_drift_{i}",
                agent_type="care_plan",
                suggested_action="Outpatient titration",
                clinician_action="Admit for IV inotropes",
                override_reason="Severe clinical decompensation",
            )

        metrics = self.feedback.get_metrics(window_size=10)
        self.assertGreater(metrics["total_overrides"], 0)
        self.assertGreater(metrics["override_rate"], OVERRIDE_DRIFT_THRESHOLD)
        self.assertTrue(metrics["is_drift_detected"])
        self.assertEqual(metrics["status"], "DRIFT_DETECTED")
        print(f"  [PASS] Test 04: Override drift detected (rate={metrics['override_rate']*100:.1f}% > 15% threshold).")

    def test_05_retraining_payload_compilation(self):
        payload = self.feedback.generate_retraining_payload()
        self.assertIn("target_models", payload)
        self.assertIn("xgboost_readmission", payload["target_models"])
        self.assertGreater(payload["total_samples"], 0)
        sample = payload["training_samples"][0]
        self.assertIn("ai_suggested", sample)
        self.assertIn("clinician_corrected", sample)
        self.assertIn("rationale", sample)
        print(f"  [PASS] Test 05: Active learning retraining payload generated ({payload['total_samples']} samples).")


def main():
    print("=================================================================")
    print(" CareLink Phase 4: Long-Term Memory (Mem0) & Active Learning")
    print("=================================================================")
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPhase4MemoryAndFeedback)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if result.wasSuccessful():
        print("\n>>> ALL PHASE 4 PYTHON VERIFICATIONS PASSED (100% SUCCESS) <<<")
        return 0
    else:
        print("\n>>> PHASE 4 PYTHON VERIFICATION FAILED <<<")
        return 1


if __name__ == "__main__":
    sys.exit(main())
