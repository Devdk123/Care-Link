/**
 * Phase 8 Verification Test Suite: Bharat Health Stack & Linguistic Accessibility
 * Tests Ayushman Bharat PM-JAY Eligibility, ABDM ABHA Identity Discovery, and Hindi ASHA Worker Mode.
 */

import { evaluatePMJAYEligibility } from "../src/lib/agents/pmjayAgent";
import { lookupAbhaProfile } from "../src/lib/agents/abhaAgent";
import { runSupervisor } from "../src/lib/agents/supervisor";
import { createInitialAgentState } from "../src/lib/agents/state";

async function runBharatTestSuite() {
  console.log("==================================================================");
  console.log("CareLink Phase 8: Bharat Health Stack & Linguistic Accessibility");
  console.log("==================================================================");

  // ── TEST 1: Ayushman Bharat PM-JAY Eligibility Checker ──
  console.log("\n--- TEST 1: PM-JAY Cashless Entitlement Check ---");
  const pmjayResult = await evaluatePMJAYEligibility(
    {
      patientId: "patient_kameshwar_10",
      age: 62,
      gender: "Male",
      admissionType: "Emergency",
      riskTier: "High",
      diagnosis: "Acute Coronary Syndrome, requiring Urgent Coronary Angioplasty and Stent",
      rationCardType: "BPL"
    },
    false
  );

  console.log(`- Scheme: ${pmjayResult.schemeName}`);
  console.log(`- Eligible: ${pmjayResult.eligible} (Amount: ${pmjayResult.coverageAmount})`);
  console.log(`- Beneficiary Tier: ${pmjayResult.beneficiaryCategory}`);
  console.log(`- Pre-Auth Status: ${pmjayResult.claimPreAuthStatus}`);
  console.log(`- Matched Benefit Packages: ${pmjayResult.eligibleProcedures.length} package(s)`);
  pmjayResult.eligibleProcedures.slice(0, 2).forEach((p) => {
    console.log(`  * [${p.packageCode}] ${p.procedureName} - Standard Rate: ${p.standardRate}`);
  });

  if (!pmjayResult.eligible || pmjayResult.coverageAmount !== "₹5,00,000 / year (per family)") {
    throw new Error("PM-JAY Eligibility check failed: Coverage amount mismatch");
  }
  console.log("[PASS] Test 1: PM-JAY Eligibility Checker verified.");

  // ── TEST 2: ABDM ABHA Identity & Longitudinal Record Discovery ──
  console.log("\n--- TEST 2: ABDM ABHA Identity Profile Lookup ---");
  const abhaResult = await lookupAbhaProfile("patient_sunita_91", false);

  console.log(`- ABHA ID: ${abhaResult.abhaId}`);
  console.log(`- ABHA Address: ${abhaResult.abhaAddress}`);
  console.log(`- Full Name: ${abhaResult.fullName} (${abhaResult.gender})`);
  console.log(`- KYC Status: ${abhaResult.kycVerificationStatus}`);
  console.log(`- Linked Facilities: ${abhaResult.linkedFacilities.length} facility records`);
  abhaResult.linkedFacilities.forEach((f) => {
    console.log(`  * ${f.facilityName} (${f.department}, ${f.visitDate})`);
  });
  console.log(`- Known Allergies: ${abhaResult.knownAllergies.join(", ")}`);

  if (!abhaResult.abhaId.startsWith("91-") || abhaResult.linkedFacilities.length < 2) {
    throw new Error("ABHA Discovery check failed: Invalid profile data");
  }
  console.log("[PASS] Test 2: ABDM ABHA Identity Lookup verified.");

  // ── TEST 3: Multi-Agent Supervisor in Hindi ASHA Worker Mode ──
  console.log("\n--- TEST 3: Multi-Agent Supervisor in Hindi ASHA Worker Mode ---");
  const hindiState = createInitialAgentState(
    "मरीज़ को दिल का दौरा पड़ने के बाद छुट्टी मिली थी। पिछले 2 दिन में वज़न 2.8 किलो बढ़ गया और पैरों में सूजन है।",
    {
      patientId: "patient_sunita_91",
      vitals: { spo2: 89, systolic: 148, diastolic: 92, weight_gain_kg: 2.8 },
      medications: ["Furosemide 40mg", "Warfarin 5mg"],
      isHindi: true
    }
  );

  const finalHindiState = await runSupervisor(hindiState);
  console.log(`- Routed Agent: ${finalHindiState.routedAgent}`);
  console.log(`- Intent Confidence: ${finalHindiState.routingConfidence}`);
  console.log(`- ABHA Profile Attached: ${finalHindiState.abhaProfile?.abhaId || "None"}`);
  console.log(`- PM-JAY Status Attached: ${finalHindiState.pmjayStatus?.coverageAmount || "None"}`);
  console.log(`- Response Snippet:\n${finalHindiState.agentResponse.slice(0, 220)}...`);

  if (!finalHindiState.agentResponse || finalHindiState.agentResponse.length < 30) {
    throw new Error("Hindi ASHA output failed to generate response");
  }
  console.log("[PASS] Test 3: Hindi ASHA Mode multi-agent run verified.");

  console.log("\n==================================================================");
  console.log("ALL PHASE 8 BHARAT HEALTH STACK TESTS COMPLETED SUCCESSFULLY [PASS]");
  console.log("==================================================================");
}

runBharatTestSuite().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
