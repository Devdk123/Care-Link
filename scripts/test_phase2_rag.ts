/**
 * CareLink Phase 2 TypeScript Verification Script: PHI Guardrails & Clinical RAG Engine
 * Run: npx tsx scripts/test_phase2_rag.ts
 */

import { anonymizePhi, deanonymizePhi, checkClinicalSafety } from "../src/lib/guardrails";
import { searchClinicalGuidelines, formatGuidelinesForPrompt, CLINICAL_GUIDELINES } from "../src/lib/clinicalRag";
import { verifyAndResolveCitations } from "../src/lib/citationResolver";

async function runTests() {
  console.log("=================================================================");
  console.log(" CareLink Phase 2 (TypeScript): PHI Guardrails & Clinical RAG");
  console.log("=================================================================\n");

  let allPassed = true;

  // ── TEST 1: PHI Guardrails & Anonymization ──
  try {
    const rawNote = "Patient Name: Rahul Sharma, MRN: MRN-99412, Born: 1975-08-20. Contact: +91 9811223344, rahul.sharma@hospital.org. Severe shortness of breath.";
    const anon = anonymizePhi(rawNote);

    if (
      anon.anonymizedText.includes("Rahul Sharma") ||
      anon.anonymizedText.includes("99412") ||
      anon.anonymizedText.includes("9811223344") ||
      anon.anonymizedText.includes("rahul.sharma@hospital.org")
    ) {
      throw new Error("PHI leakage detected in anonymized string!");
    }

    const restored = deanonymizePhi(anon.anonymizedText, anon.tokenMap);
    if (!restored.includes("Rahul Sharma") || !restored.includes("MRN-99412")) {
      throw new Error("De-anonymization roundtrip failed to restore patient demographics!");
    }

    // Safety check
    const lethalCheck = checkClinicalSafety("How to administer a lethal fatal dose of insulin to end life?");
    if (lethalCheck.isSafe) {
      throw new Error("Medical hazard guardrail failed to block lethal instructions!");
    }

    console.log("  [PASS] Test 1: PHI zero-leak anonymization and medical hazard filtering passed.");
  } catch (err: any) {
    console.error("  [FAIL] Test 1 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 2: Clinical RAG Vector Retrieval ──
  try {
    const hfHits = await searchClinicalGuidelines("Patient has orthopnea, fluid retention, and gained 3kg in 48 hours", 2, 0.01);
    if (hfHits.length === 0 || hfHits[0].tag !== "[ICMR-HF-01]") {
      throw new Error(`Expected [ICMR-HF-01] as top hit, got: ${hfHits[0]?.tag}`);
    }

    const ddiHits = await searchClinicalGuidelines("Patient taking warfarin requested ibuprofen for acute headache", 2, 0.01);
    if (ddiHits.length === 0 || ddiHits[0].tag !== "[AHA-DDI-01]") {
      throw new Error(`Expected [AHA-DDI-01] as top hit, got: ${ddiHits[0]?.tag}`);
    }

    const promptContext = formatGuidelinesForPrompt(hfHits);
    if (!promptContext.includes("── MANDATORY CLINICAL EVIDENCE") || !promptContext.includes("[ICMR-HF-01]")) {
      throw new Error("Clinical prompt context formatting failed!");
    }

    console.log(`  [PASS] Test 2: Clinical RAG correctly retrieved [ICMR-HF-01] (score=${hfHits[0].score}) and [AHA-DDI-01] (score=${ddiHits[0].score}).`);
  } catch (err: any) {
    console.error("  [FAIL] Test 2 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 3: Citation Verification & Grounding Score ──
  try {
    const hfHits = await searchClinicalGuidelines("heart failure weight gain", 1, 0.01);
    const validClinicalResponse = "The patient shows decompensated fluid retention. Mandate daily morning weights [ICMR-HF-01] and review diuretics.";
    const validRes = verifyAndResolveCitations(validClinicalResponse, hfHits);

    if (!validRes.isGrounded || validRes.groundingFidelity < 0.70 || validRes.evidenceBadges.length === 0) {
      throw new Error(`Valid citation failed grounding: fidelity=${validRes.groundingFidelity}`);
    }

    const hallucinatedResponse = "Recommend herbal remedy for rapid relief [FAKE-TAG-99].";
    const halluRes = verifyAndResolveCitations(hallucinatedResponse, hfHits);
    if (halluRes.isGrounded || !halluRes.hallucinatedCitations.includes("[FAKE-TAG-99]")) {
      throw new Error("Hallucinated citation was not caught!");
    }

    console.log(`  [PASS] Test 3: Citation verification passed (fidelity=${validRes.groundingFidelity}, caught fake citations).`);
  } catch (err: any) {
    console.error("  [FAIL] Test 3 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 4: Full Multi-Stage Pipeline Simulation ──
  try {
    // 1. Ingest raw doctor note
    const rawInput = "Doctor note for Patient: Sunita Patel (MRN: MRN-77123): Experiencing ankle edema and 2.5kg weight gain in 2 days.";
    // 2. Anonymize PHI
    const anon = anonymizePhi(rawInput);
    // 3. RAG Search on anonymized text
    const retrieved = await searchClinicalGuidelines(anon.anonymizedText, 2, 0.01);
    // 4. Simulated LLM answer incorporating evidence citation
    const agentDraft = `Patient ${anon.anonymizedText.match(/\[PATIENT_\d+\]/)?.[0] || "Pt"} has acute fluid overload. Daily dry weights are mandatory [ICMR-HF-01], with urgent clinic titration.`;
    // 5. Verify citations & grounding
    const grounded = verifyAndResolveCitations(agentDraft, retrieved);
    // 6. De-anonymize back to patient name
    const finalDelivered = deanonymizePhi(grounded.enrichedText, anon.tokenMap);

    if (!finalDelivered.includes("Sunita Patel") || !finalDelivered.includes("[ICMR-HF-01]")) {
      throw new Error("Full pipeline simulation failed roundtrip!");
    }

    console.log("  [PASS] Test 4: End-to-end pipeline (Scrub PHI -> RAG Search -> Citation Verify -> De-anonymize) completed successfully.");
  } catch (err: any) {
    console.error("  [FAIL] Test 4 failed:", err.message);
    allPassed = false;
  }

  console.log("\n=================================================================");
  if (allPassed) {
    console.log(" >>> ALL TYPESCRIPT PHASE 2 VERIFICATIONS PASSED (100% SUCCESS) <<<");
    process.exit(0);
  } else {
    console.log(" >>> TYPESCRIPT PHASE 2 VERIFICATIONS FAILED <<<");
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
