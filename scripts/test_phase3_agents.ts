/**
 * CareLink Phase 3 TypeScript Verification Script: LangGraph Supervisor & Specialist Agents
 * Run: npx tsx scripts/test_phase3_agents.ts
 */

import { createInitialAgentState } from "../src/lib/agents/state";
import { classifyClinicalIntent, routeAgent, runSupervisor } from "../src/lib/agents/supervisor";
import { evaluateVitalsSeverity } from "../src/lib/agents/triageAgent";
import { checkDeterministicDdi } from "../src/lib/agents/medicationSafetyAgent";
import { runRiskAnalystAgent } from "../src/lib/agents/riskAnalystAgent";
import { runCarePlanAgent } from "../src/lib/agents/carePlanAgent";

async function runTests() {
  console.log("=================================================================");
  console.log(" CareLink Phase 3 (TypeScript): Supervisor & Specialist Agents");
  console.log("=================================================================\n");

  let allPassed = true;

  // ── TEST 1: Intent Classification & Routing ──
  try {
    const r1 = await classifyClinicalIntent("Severe chest pain, low SpO2 86%, emergency triage needed");
    if (r1.intent !== "triage") throw new Error(`Expected 'triage', got ${r1.intent}`);

    const r2 = await classifyClinicalIntent("Can I take ibuprofen with my daily warfarin dosage?");
    if (r2.intent !== "medication_safety") throw new Error(`Expected 'medication_safety', got ${r2.intent}`);

    const r3 = await classifyClinicalIntent("Explain why XGBoost predicted a high readmission risk using SHAP");
    if (r3.intent !== "risk_analyst") throw new Error(`Expected 'risk_analyst', got ${r3.intent}`);

    const r4 = await classifyClinicalIntent("Need a post-discharge care plan and appointment schedule");
    if (r4.intent !== "care_plan") throw new Error(`Expected 'care_plan', got ${r4.intent}`);

    // Confidence floor fallback
    const routedFallback = routeAgent("unknown_agent", 0.35);
    if (routedFallback !== "triage") throw new Error(`Expected fallback to 'triage', got ${routedFallback}`);

    console.log("  [PASS] Test 1: Supervisor intent classification & confidence floor routing passed.");
  } catch (err: any) {
    console.error("  [FAIL] Test 1 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 2: Vitals Evaluation & MTS Rules ──
  try {
    const e1 = evaluateVitalsSeverity({ spo2: 85, heart_rate: 115 });
    if (e1.level !== "Emergency" || !e1.triggers.some((t) => t.includes("Hypoxemia"))) {
      throw new Error("Failed to detect Emergency hypoxemia!");
    }

    const e2 = evaluateVitalsSeverity({ systolic: 190, diastolic: 110 });
    if (e2.level !== "Emergency" || !e2.triggers.some((t) => t.includes("Hypertensive Crisis"))) {
      throw new Error("Failed to detect Hypertensive Crisis!");
    }

    const e3 = evaluateVitalsSeverity({ weight_gain_kg: 2.8 });
    if (e3.level !== "Urgent" || !e3.triggers.some((t) => t.includes("Fluid Overload"))) {
      throw new Error("Failed to detect Acute Fluid Overload!");
    }

    const e4 = evaluateVitalsSeverity({ spo2: 98, systolic: 120, temperature: 98.6 });
    if (e4.level !== "Routine" || e4.triggers.length > 0) {
      throw new Error("Failed to classify stable vitals as Routine!");
    }

    console.log("  [PASS] Test 2: Manchester Triage System (MTS) vitals evaluation passed.");
  } catch (err: any) {
    console.error("  [FAIL] Test 2 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 3: Medication Safety Critical Blocker ──
  try {
    const ddi1 = checkDeterministicDdi(["warfarin", "ibuprofen"], "Patient requesting NSAID for severe knee pain");
    if (!ddi1.isCriticalBlocked || ddi1.alerts.length === 0 || !ddi1.alerts[0].citation.includes("[AHA-DDI-01]")) {
      throw new Error("Failed to block Warfarin + Ibuprofen interaction!");
    }

    const ddi2 = checkDeterministicDdi(["metformin"], "Routine diabetes review", { egfr: 25 });
    if (!ddi2.isCriticalBlocked || !ddi2.alerts.some((a) => a.citation.includes("[ICMR-DM-01]"))) {
      throw new Error("Failed to block Metformin with eGFR < 30!");
    }

    console.log("  [PASS] Test 3: Medication safety critical DDI blocker passed.");
  } catch (err: any) {
    console.error("  [FAIL] Test 3 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 4: Risk Analyst Agent ──
  try {
    const state = createInitialAgentState("Explain readmission risk drivers", {
      patientDemographics: {
        readmission_risk_score: 0.72,
        shap_factors: [
          { feature: "Prior Emergency Admissions (>=2 in 12m)", attribution: "+0.28" },
          { feature: "Recent eGFR Drop (<40 mL/min)", attribution: "+0.19" }
        ]
      }
    });

    const analyzed = await runRiskAnalystAgent(state);
    if (!analyzed.agentResponse.includes("READMISSION RISK") || analyzed.routedAgent !== "risk_analyst") {
      throw new Error("Risk Analyst Agent failed to synthesize explainability report!");
    }

    console.log("  [PASS] Test 4: Risk Analyst Agent synthesized SHAP risk narrative.");
  } catch (err: any) {
    console.error("  [FAIL] Test 4 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 5: Care Plan Agent ──
  try {
    const state = createInitialAgentState("Generate discharge plan for heart failure patient", {
      medications: ["furosemide", "carvedilol"]
    });

    const planned = await runCarePlanAgent(state);
    if (!planned.agentResponse.includes("POST-DISCHARGE CLINICAL CARE PLAN") || planned.routedAgent !== "care_plan") {
      throw new Error("Care Plan Agent failed to generate 4-part discharge plan!");
    }

    console.log("  [PASS] Test 5: Care Plan Agent synthesized 4-part post-discharge plan.");
  } catch (err: any) {
    console.error("  [FAIL] Test 5 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 6: Full Multi-Agent Supervisor Orchestration ──
  try {
    const state = createInitialAgentState(
      "Patient has acute orthopnea and gained 3kg in 48 hours",
      {
        vitals: { spo2: 91, weight_gain_kg: 3.0, systolic: 140 },
        medications: ["furosemide", "carvedilol"]
      }
    );

    const executed = await runSupervisor(state);

    if (executed.routedAgent !== "triage") {
      throw new Error(`Expected routedAgent 'triage', got '${executed.routedAgent}'`);
    }

    if (executed.executionSteps.length < 3) {
      throw new Error(`Expected at least 3 execution steps, got ${executed.executionSteps.length}`);
    }

    if (!executed.isGrounded || executed.groundingFidelity < 0.70) {
      throw new Error(`Expected grounding fidelity >= 0.70, got ${executed.groundingFidelity}`);
    }

    console.log(`  [PASS] Test 6: Full Multi-Agent Supervisor completed with ${executed.executionSteps.length} trace steps (fidelity=${executed.groundingFidelity}).`);
  } catch (err: any) {
    console.error("  [FAIL] Test 6 failed:", err.message);
    allPassed = false;
  }

  console.log("\n=================================================================");
  if (allPassed) {
    console.log(" >>> ALL TYPESCRIPT PHASE 3 VERIFICATIONS PASSED (100% SUCCESS) <<<");
    process.exit(0);
  } else {
    console.log(" >>> TYPESCRIPT PHASE 3 VERIFICATIONS FAILED <<<");
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
