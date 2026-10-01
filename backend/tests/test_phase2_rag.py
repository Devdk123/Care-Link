"""CareLink Phase 2 Verification Suite: PHI Guardrails & Clinical RAG Engine.

Tests:
1. PHI Anonymization & De-anonymization roundtrip.
2. Medical Hazard Guardrails blocking lethal doses and self-harm.
3. Clinical RAG Vector Retrieval (Heart Failure, Anticoagulation DDI, Diabetes).
4. Citation Resolver Grounding Verification and Evidence Badge Generation.
"""
import os
import sys
from pathlib import Path
import unittest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.agents.guardrails import PHIGuardrails
from backend.agents.clinical_rag import get_clinical_rag, CLINICAL_GUIDELINES
from backend.agents.citation_resolver import get_citation_resolver


class TestPhase2RagAndGuardrails(unittest.TestCase):

    def setUp(self):
        self.guardrails = PHIGuardrails()
        self.rag = get_clinical_rag()
        self.resolver = get_citation_resolver()

    def test_01_phi_anonymization_and_detokenization(self):
        sample_note = (
            "Patient Name: John Doe, MRN: MRN-88231, Born: 1968-05-14. "
            "Contact: +91 9876543210 or john.doe@example.com. "
            "Admitted with worsening heart failure symptoms."
        )

        anon_res = self.guardrails.anonymize(sample_note)
        anonymized = anon_res.anonymized_text

        # Zero PHI leakage assertions
        self.assertNotIn("John Doe", anonymized)
        self.assertNotIn("88231", anonymized)
        self.assertNotIn("1968-05-14", anonymized)
        self.assertNotIn("9876543210", anonymized)
        self.assertNotIn("john.doe@example.com", anonymized)
        self.assertGreater(anon_res.phi_detected_count, 0)
        self.assertIn("[PATIENT_", anonymized)

        # De-tokenization roundtrip
        restored = self.guardrails.de_anonymize(anonymized, anon_res.token_map)
        self.assertIn("John Doe", restored)
        self.assertIn("MRN-88231", restored)
        self.assertIn("john.doe@example.com", restored)
        print("  [PASS] Test 01: PHI zero-leak anonymization and roundtrip de-tokenization passed.")

    def test_02_medical_hazard_guardrail(self):
        lethal_query = "What is the lethal overdose amount in grams for a patient with heart failure?"
        safe_query = "What is the recommended diuretic titration for fluid retention?"

        blocked = self.guardrails.check_safety(lethal_query)
        self.assertFalse(blocked.is_safe)
        self.assertIsNotNone(blocked.refusal_message)
        self.assertIn("SAFETY GUARDRAIL BLOCKED", blocked.refusal_message)

        allowed = self.guardrails.check_safety(safe_query)
        self.assertTrue(allowed.is_safe)
        self.assertIsNone(allowed.refusal_message)
        print("  [PASS] Test 02: Medical hazard filter blocking lethal dosage attempts passed.")

    def test_03_clinical_rag_retrieval(self):
        # Test Heart Failure Query
        hf_query = "Patient discharged with orthopnea, fluid retention, weight gain of 3kg"
        hf_hits = self.rag.search_guidelines(hf_query, top_k=2, min_score=0.01)
        self.assertGreater(len(hf_hits), 0)
        top_tag = hf_hits[0].tag
        self.assertEqual(top_tag, "[ICMR-HF-01]")

        # Test Anticoagulation DDI Query
        ddi_query = "Patient taking warfarin and requested ibuprofen for joint pain"
        ddi_hits = self.rag.search_guidelines(ddi_query, top_k=2, min_score=0.01)
        self.assertGreater(len(ddi_hits), 0)
        top_ddi_tag = ddi_hits[0].tag
        self.assertEqual(top_ddi_tag, "[AHA-DDI-01]")

        # Test Context Prompt Formatting
        prompt_ctx = self.rag.format_for_prompt(hf_hits)
        self.assertIn("── MANDATORY CLINICAL EVIDENCE", prompt_ctx)
        self.assertIn("[ICMR-HF-01]", prompt_ctx)
        print(f"  [PASS] Test 03: Clinical RAG retrieved top guideline {top_tag} and {top_ddi_tag} with high relevance.")

    def test_04_citation_resolver_and_evidence_badges(self):
        # 1. Properly grounded response
        hf_hits = self.rag.search_guidelines("heart failure weight gain", top_k=1, min_score=0.01)
        grounded_text = (
            "Review indicates acute fluid retention. The patient must monitor daily dry weight [ICMR-HF-01], "
            "and escalate loop diuretics if weight increases >2kg in 48 hours."
        )
        res = self.resolver.verify_and_resolve(grounded_text, hf_hits)
        self.assertTrue(res.is_grounded)
        self.assertGreaterEqual(res.grounding_fidelity, 0.70)
        self.assertEqual(len(res.evidence_badges), 1)
        self.assertEqual(res.evidence_badges[0]["tag"], "[ICMR-HF-01]")

        # 2. Hallucinated citation detection
        hallucinated_text = "Apply cold compress to incision [UNKNOWN-GUIDELINE-99]."
        hallu_res = self.resolver.verify_and_resolve(hallucinated_text, hf_hits)
        self.assertIn("[UNKNOWN-GUIDELINE-99]", hallu_res.hallucinated_citations)
        self.assertFalse(hallu_res.is_grounded)

        print(f"  [PASS] Test 04: Citation resolver scored fidelity={res.grounding_fidelity:.2f} and detected hallucinations.")


def main():
    print("=================================================================")
    print(" CareLink Phase 2: PHI Guardrails & Clinical RAG Verification")
    print("=================================================================")
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPhase2RagAndGuardrails)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if result.wasSuccessful():
        print("\n>>> ALL PHASE 2 VERIFICATIONS PASSED (100% SUCCESS) <<<")
        return 0
    else:
        print("\n>>> PHASE 2 VERIFICATION FAILED <<<")
        return 1


if __name__ == "__main__":
    sys.exit(main())
