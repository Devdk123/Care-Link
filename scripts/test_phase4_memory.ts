/**
 * CareLink Phase 4 TypeScript Verification Script: Long-Term Memory & Active Learning
 * Run: npx tsx scripts/test_phase4_memory.ts
 */

import { rememberPatient, recallPatient, formatMemoryContext } from "../src/lib/memory";
import {
  recordClinicianFeedback,
  getFeedbackMetrics,
  generateRetrainingPayload,
  OVERRIDE_DRIFT_THRESHOLD
} from "../src/lib/feedbackAgent";
import { createInitialAgentState } from "../src/lib/agents/state";
import { runSupervisor } from "../src/lib/agents/supervisor";

async function runTests() {
  console.log("=================================================================");
  console.log(" CareLink Phase 4 (TypeScript): Long-Term Memory & Active Learning");
  console.log("=================================================================\n");

  let allPassed = true;

  // ── TEST 1: Patient Memory Storage & Recall ──
  try {
    const pid = "patient_mem_ts_01";
    await rememberPatient(pid, "Severe anaphylactic reaction to Penicillin and Amoxicillin", "allergies");
    await rememberPatient(pid, "Congestive Heart Failure NYHA Class III; baseline LVEF 30%", "chronic");
    await rememberPatient(pid, "Target dry weight 68.5 kg, alert if weight increases >2kg", "care_plan");

    const recalledAllergies = await recallPatient(pid, "allergy penicillin", 2);
    if (recalledAllergies.length === 0 || !recalledAllergies.some((m) => m.toLowerCase().includes("penicillin"))) {
      throw new Error("Failed to recall patient allergy memory!");
    }

    const allMemories = await recallPatient(pid, "", 5);
    if (allMemories.length < 3) {
      throw new Error(`Expected at least 3 memories, got ${allMemories.length}`);
    }

    console.log(`  [PASS] Test 1: Patient memory stored and recalled (${recalledAllergies.length} allergy hit(s)).`);
  } catch (err: any) {
    console.error("  [FAIL] Test 1 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 2: Memory Context Formatting ──
  try {
    const memories = [
      "Severe anaphylaxis to Penicillin",
      "Baseline eGFR 38 mL/min",
      "Target dry weight 68.5 kg"
    ];
    const block = formatMemoryContext(memories);
    if (!block.includes("-- PATIENT LONG-TERM CLINICAL MEMORY") || !block.includes("Penicillin")) {
      throw new Error("Memory context prompt formatting failed!");
    }

    console.log("  [PASS] Test 2: Memory context block formatting passed.");
  } catch (err: any) {
    console.error("  [FAIL] Test 2 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 3: Clinician Feedback & Override Classification ──
  try {
    const appRecord = recordClinicianFeedback(
      "int_app_01",
      "pt_100",
      "triage",
      "Routine 7-day review",
      "Approved",
      "",
      "dr_sharma"
    );
    if (appRecord.isOverride) throw new Error("Expected approval to not be flagged as override!");

    const overRecord = recordClinicianFeedback(
      "int_over_01",
      "pt_101",
      "triage",
      "Routine 7-day review",
      "Urgent Same-Day Transfer",
      "SpO2 borderline 91% and severe orthopnea",
      "dr_sharma"
    );
    if (!overRecord.isOverride || !overRecord.overrideReason.includes("orthopnea")) {
      throw new Error("Expected clinician rejection to be flagged as override!");
    }

    console.log("  [PASS] Test 3: Clinician feedback approval & override classification passed.");
  } catch (err: any) {
    console.error("  [FAIL] Test 3 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 4: Override Rate Drift Detection (>15%) ──
  try {
    // Add 4 more overrides -> total 1 approval, 5 overrides (5/6 = 83% > 15%)
    for (let i = 0; i < 4; i++) {
      recordClinicianFeedback(
        `int_drift_${i}`,
        `pt_${i}`,
        "care_plan",
        "Home fluid restriction",
        "Hospital Admission for IV Diuretics",
        "Fluid overload refractory to oral furosemide",
        "dr_verma"
      );
    }

    const metrics = getFeedbackMetrics(10);
    if (!metrics.isDriftDetected || metrics.status !== "DRIFT_DETECTED" || metrics.overrideRate <= OVERRIDE_DRIFT_THRESHOLD) {
      throw new Error(`Expected drift detection! Rate=${metrics.overrideRate}`);
    }

    console.log(`  [PASS] Test 4: Drift detection triggered (override rate=${metrics.overrideRate * 100}% > 15% threshold).`);
  } catch (err: any) {
    console.error("  [FAIL] Test 4 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 5: Active Learning Retraining Payload ──
  try {
    const payload = generateRetrainingPayload();
    if (payload.totalSamples === 0 || !payload.targetModels.includes("xgboost_readmission")) {
      throw new Error("Failed to generate active learning retraining payload!");
    }

    const sample = payload.trainingSamples[0];
    if (!sample.aiSuggested || !sample.clinicianCorrected || !sample.rationale) {
      throw new Error("Retraining sample is missing required features!");
    }

    console.log(`  [PASS] Test 5: Retraining dataset compiled with ${payload.totalSamples} corrected samples.`);
  } catch (err: any) {
    console.error("  [FAIL] Test 5 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 6: Memory-Informed Multi-Agent Execution ──
  try {
    const state = createInitialAgentState("Patient has acute orthopnea, fluid overload, and gained 2.5kg in 48 hours", {
      patientId: "patient_mem_ts_01",
      memoryContext: [
        "Patient has known Congestive Heart Failure NYHA Class III",
        "Severe anaphylaxis to Penicillin"
      ],
      vitals: { spo2: 91, heart_rate: 96, weight_gain_kg: 2.5 }
    });

    const finalState = await runSupervisor(state);
    if (!finalState.isGrounded || finalState.executionSteps.length < 3) {
      throw new Error(`Memory-informed agent execution failed (isGrounded=${finalState.isGrounded}, steps=${finalState.executionSteps.length})`);
    }

    console.log(`  [PASS] Test 6: Memory-informed multi-agent execution completed (steps=${finalState.executionSteps.length}, fidelity=${finalState.groundingFidelity}).`);
  } catch (err: any) {
    console.error("  [FAIL] Test 6 failed:", err.message);
    allPassed = false;
  }

  console.log("\n=================================================================");
  if (allPassed) {
    console.log(" >>> ALL TYPESCRIPT PHASE 4 VERIFICATIONS PASSED (100% SUCCESS) <<<");
    process.exit(0);
  } else {
    console.log(" >>> TYPESCRIPT PHASE 4 VERIFICATIONS FAILED <<<");
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
