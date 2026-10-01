/**
 * CareLink Phase 9 Verification Script: Real Function Calling & Autonomous Action Agents
 * Run: npx tsx scripts/test_phase9_autonomy.ts
 */

import {
  executeCheckVitalsTool,
  executeLookupGuidelineTool,
  executeRecommendEscalationTool,
  runTriageAgent
} from "../src/lib/agents/triageAgent";
import { generatePatientWhatsAppMessage } from "../src/lib/agents/patientCommunicationAgent";
import { evaluateTelemetryDeterioration, simulateVitalsDeterioration } from "../src/lib/agents/vitalsMonitorAgent";
import { autoBookFollowUpAppointment } from "../src/lib/agents/appointmentAgent";
import { createInitialAgentState } from "../src/lib/agents/state";

async function runPhase9Tests() {
  console.log("=================================================================");
  console.log(" CareLink Phase 9: Real Function Calling & Autonomous Action Agents");
  console.log("=================================================================\n");

  let allPassed = true;

  // ── TEST 1: Triage Tool Calling (check_vitals, lookup_guideline, recommend_escalation) ──
  try {
    console.log("TEST 1: Triage Agent Real Function Calling & Multi-Step Execution");
    
    // 1a. Check Vitals Tool
    const vResult = executeCheckVitalsTool({ spo2: 86, systolic: 195, heart_rate: 118 });
    if (vResult.urgencyLevel !== "Emergency") {
      throw new Error(`Expected Emergency triage, got ${vResult.urgencyLevel}`);
    }
    if (!vResult.triggers.some(t => t.includes("Hypoxemia"))) {
      throw new Error("Missing Critical Hypoxemia trigger");
    }
    if (!vResult.triggers.some(t => t.includes("Hypertensive Crisis"))) {
      throw new Error("Missing Hypertensive Crisis trigger");
    }
    console.log("  [PASS] 1a: executeCheckVitalsTool correctly detected emergency triggers:", vResult.triggers);

    // 1b. Lookup Guideline Tool
    const gResult = await executeLookupGuidelineTool("acute chest pain and low spo2");
    if (!gResult || gResult.length === 0 || !gResult[0].tag) {
      throw new Error("executeLookupGuidelineTool failed to return guideline array");
    }
    console.log(`  [PASS] 1b: executeLookupGuidelineTool resolved guideline: [${gResult[0].tag}]`);

    // 1c. Recommend Escalation Tool
    const eResult = executeRecommendEscalationTool("Emergency", vResult.triggers);
    if (eResult.slaHours !== 2 || !eResult.requiresImmediateER) {
      throw new Error("executeRecommendEscalationTool SLA invalid for Emergency");
    }
    console.log(`  [PASS] 1c: executeRecommendEscalationTool set SLA: < ${eResult.slaHours} hrs, Action: ${eResult.action}`);

    // 1d. Full Triage Agent Execution with StateGraph
    const triageState = createInitialAgentState(
      "Patient reports sudden shortness of breath and wheezing",
      {
        patientId: "P-9012",
        vitals: { spo2: 87, systolic: 170, diastolic: 100 },
        medications: ["Albuterol", "Lisinopril"]
      }
    );
    const completedState = await runTriageAgent(triageState);
    if (!completedState.agentResponse || completedState.agentResponse.length < 20) {
      throw new Error("Triage agent failed to produce structured decision");
    }
    const toolSteps = completedState.executionSteps.filter(s => s.action.startsWith("tool_use:"));
    if (toolSteps.length < 3) {
      throw new Error(`Expected at least 3 tool execution steps, found ${toolSteps.length}`);
    }
    console.log(`  [PASS] 1d: runTriageAgent completed with ${toolSteps.length} tool executions logged in state.`);
  } catch (err: any) {
    console.error("  [FAIL] Test 1 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 2: Autonomous WhatsApp Patient Communication Agent ──
  try {
    console.log("\nTEST 2: Autonomous Patient Communication Agent (WhatsApp & SMS Dispatch)");
    
    const commsResult = generatePatientWhatsAppMessage({
      patientName: "Ramesh Kumar",
      patientPhone: "+919876543210",
      medications: ["Metformin 500mg BD", "Lisinopril 10mg OD", "Aspirin 75mg OD"],
      isHindi: true
    });

    if (!commsResult.messageText.includes("CareLink")) {
      throw new Error("WhatsApp message does not contain CareLink header");
    }
    if (!commsResult.whatsappDeepLink.startsWith("https://wa.me/")) {
      throw new Error(`Invalid wa.me dispatch URL: ${commsResult.whatsappDeepLink}`);
    }
    if (commsResult.sections.medicationsSchedule.length !== 3) {
      throw new Error(`Expected 3 scheduled meds, got ${commsResult.sections.medicationsSchedule.length}`);
    }
    if (commsResult.sections.redFlagSigns.length === 0) {
      throw new Error("Missing plain-language red flags in communication");
    }

    console.log(`  [PASS] 2a: Generated Hindi WhatsApp dispatch for ${commsResult.recipientName}`);
    console.log(`  [PASS] 2b: Dispatch URL generated: ${commsResult.whatsappDeepLink.slice(0, 45)}...`);
    console.log(`  [PASS] 2c: Med schedule parsed: ${commsResult.sections.medicationsSchedule.length} medications mapped with timing.`);
  } catch (err: any) {
    console.error("  [FAIL] Test 2 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 3: Autonomous Telemetry Monitoring & Anomaly Detection ──
  try {
    console.log("\nTEST 3: Autonomous Telemetry Monitoring Agent");

    // 3a. Normal vitals -> No alert
    const normalAlert = evaluateTelemetryDeterioration({
      patientId: "P-1001",
      patientName: "Normal Patient",
      spo2: 98,
      heartRate: 72,
      systolic: 120,
      diastolic: 80,
      temperature: 98.6,
      timestamp: new Date().toISOString()
    });
    if (normalAlert !== null) {
      throw new Error("Expected null alert for normal vitals");
    }
    console.log("  [PASS] 3a: Normal vitals correctly evaluated with null alert.");

    // 3b. Simulated Acute Drop to 88% -> Immediate Emergency Alert
    const dropEvent = simulateVitalsDeterioration("P-1001", "hypoxemia");
    if (!dropEvent.alert) {
      throw new Error("Simulated drop failed to trigger alert");
    }
    if (dropEvent.alert.severity !== "EMERGENCY" || dropEvent.telemetry.spo2 !== 88) {
      throw new Error(`Unexpected alert severity: ${dropEvent.alert.severity} (SpO2: ${dropEvent.telemetry.spo2})`);
    }
    if (!dropEvent.alert.immediateAction.includes("oxygen")) {
      throw new Error("Missing emergency oxygen protocol in escalation action");
    }
    console.log(`  [PASS] 3b: Acute telemetry drop (SpO2 ${dropEvent.telemetry.spo2}%) triggered EMERGENCY alert [${dropEvent.alert.alertId}] with SLA ${dropEvent.alert.escalationWindow}.`);
  } catch (err: any) {
    console.error("  [FAIL] Test 3 failed:", err.message);
    allPassed = false;
  }

  // ── TEST 4: Autonomous Appointment Booking in CareLink EHR ──
  try {
    console.log("\nTEST 4: Autonomous Follow-Up Appointment Scheduler");

    const booking = await autoBookFollowUpAppointment({
      patientId: "P-4019",
      patientName: "Meera Patel",
      riskTier: "HIGH",
      urgencyLevel: "Urgent",
      specialty: "Cardiology"
    });

    if (!booking.bookingId.startsWith("APT-2026-")) {
      throw new Error(`Invalid booking ID format: ${booking.bookingId}`);
    }
    if (booking.status !== "CONFIRMED_AUTONOMOUS") {
      throw new Error(`Expected CONFIRMED_AUTONOMOUS status, got ${booking.status}`);
    }
    if (!booking.doctorName.includes("Rajesh Sharma")) {
      throw new Error(`Expected Dr. Rajesh Sharma, got ${booking.doctorName}`);
    }
    console.log(`  [PASS] 4a: Reserved slot ${booking.bookingId} with ${booking.doctorName} on ${booking.appointmentDate} at ${booking.timeSlot} (${booking.room})`);
  } catch (err: any) {
    console.error("  [FAIL] Test 4 failed:", err.message);
    allPassed = false;
  }

  console.log("\n=================================================================");
  if (allPassed) {
    console.log(" ✅ ALL PHASE 9 AUTONOMOUS AGENT & FUNCTION CALLING TESTS PASSED!");
  } else {
    console.log(" ❌ SOME TESTS FAILED. Check logs above.");
    process.exit(1);
  }
  console.log("=================================================================");
}

runPhase9Tests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
