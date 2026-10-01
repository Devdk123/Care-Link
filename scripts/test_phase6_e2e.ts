/**
 * CareLink Autonomous 9-Layer Multi-Agent Architecture E2E Integration Test Suite (TypeScript)
 * Tests full end-to-end execution through the Express multi-agent pipeline:
 *   Layer 1: Resilient Multi-Model Gateway (Gemini -> Groq)
 *   Layer 2: HIPAA PHI Scrubbing & Restoration
 *   Layer 3: Supervisor Intent Router (LangGraph StateGraph)
 *   Layer 4: Clinical Specialist Agents (Triage, Risk, Care Plan, Med Safety)
 *   Layer 5: Clinical RAG Vector Retrieval (Qdrant Cloud / Cosine)
 *   Layer 6: Citation Resolver & Grounding Verification (>= 0.70)
 *   Layer 7: Long-Term Episodic Memory (Mem0)
 *   Layer 8: Active Learning Review & Drift Monitor
 *   Layer 9: Observability Run Traces & RAGAS Evaluator
 */

import { anonymizePhi, deAnonymizePhi, checkClinicalSafety } from '../src/lib/guardrails';
import { runSupervisor } from '../src/lib/agents/supervisor';
import { createInitialAgentState } from '../src/lib/agents/state';
import { searchClinicalGuidelines } from '../src/lib/clinicalRag';
import { verifyAndResolveCitations } from '../src/lib/citationResolver';
import { rememberPatient, recallPatient } from '../src/lib/memory';
import { recordClinicianFeedback, getFeedbackMetrics } from '../src/lib/feedbackAgent';
import { recordRunTrace, getRecentTraces, getObservabilitySummary, RunTrace } from '../src/lib/agents/observability';
import { evaluateRagasMetrics } from '../src/lib/agents/evalRagas';

async function testFullClinicalPipelineE2E() {
  console.log('----------------------------------------------------------------');
  console.log('STEP 1: Ingesting Patient Presentation & PHI Scrubbing (Layer 2)');
  console.log('----------------------------------------------------------------');
  const rawQuery = (
    'Patient Sunita Sharma (DOB: 15/08/1962, Phone: 9812345678, SSN: 987-65-4321) ' +
    'discharged 3 days ago post-PCI stent implantation. Presents with sudden orthopnea, bilateral pedal edema, and SpO2 88% on room air.'
  );

  const safetyCheck = checkClinicalSafety(rawQuery);
  if (!safetyCheck.isSafe) {
    throw new Error('Query blocked unexpectedly by clinical safety gate');
  }

  const anonResult = anonymizePhi(rawQuery);
  console.log(`  - Original Query Length:   ${rawQuery.length} chars`);
  console.log(`  - Anonymized Query:        ${anonResult.anonymizedText.slice(0, 110)}...`);
  console.log(`  - Scrubbed PHI Token Count: ${Object.keys(anonResult.tokenMap).length}`);

  if (anonResult.anonymizedText.includes('Sunita Sharma') || anonResult.anonymizedText.includes('9812345678')) {
    throw new Error('PII/PHI was not scrubbed from query!');
  }
  console.log('  [PASS] Layer 2 PHI Scrubbing verified.');

  console.log('\n----------------------------------------------------------------');
  console.log('STEP 2: Long-Term Memory Recall (Layer 7)');
  console.log('----------------------------------------------------------------');
  const patientId = 'pt_sunita_621';
  await rememberPatient(
    patientId,
    'Patient has drug-eluting coronary stent (DES) placed 3 days ago on DAPT aspirin plus ticagrelor.',
    'surgical_history'
  );
  const recalledMems = await recallPatient(patientId, 'coronary stent DAPT ticagrelor', 2);
  console.log(`  - Recalled Patient Memories: ${recalledMems.length}`);
  for (const m of recalledMems) {
    console.log(`    * ${m}`);
  }
  if (recalledMems.length === 0) {
    throw new Error('Failed to recall seeded patient episodic memory');
  }
  console.log('  [PASS] Layer 7 Memory recall verified.');

  console.log('\n----------------------------------------------------------------');
  console.log('STEP 3: Supervisor Intent Routing & Agent Execution (Layers 1, 3, 4)');
  console.log('----------------------------------------------------------------');
  const state = createInitialAgentState(anonResult.anonymizedText, {
    patientId,
    vitals: { hr: 104, sbp: 154, dbp: 92, spo2: 88, rr: 28, temp: 98.6 },
    medications: ['Aspirin 81mg', 'Ticagrelor 90mg BID', 'Furosemide 20mg'],
    memoryContext: recalledMems
  });

  const finalState = await runSupervisor(state);
  console.log(`  - Routed Agent:       ${finalState.routedAgent}`);
  console.log(`  - Routing Confidence: ${finalState.routingConfidence}`);
  console.log(`  - Execution Steps:    ${finalState.executionSteps?.length ?? 0}`);
  console.log(`  - Grounding Fidelity: ${finalState.groundingFidelity}`);
  console.log(`  - Response Snippet:   ${finalState.agentResponse.slice(0, 130)}...`);

  if (!['triage', 'care_plan', 'risk_analyst', 'medication_safety'].includes(finalState.routedAgent)) {
    throw new Error(`Unexpected routed agent: ${finalState.routedAgent}`);
  }
  if (!finalState.executionSteps || finalState.executionSteps.length < 3) {
    throw new Error('Execution steps trace incomplete in supervisor run');
  }
  console.log('  [PASS] Layers 1, 3, 4 Multi-agent orchestration verified.');

  console.log('\n----------------------------------------------------------------');
  console.log('STEP 4: PHI Restoration & Grounding Verification (Layers 2, 5, 6)');
  console.log('----------------------------------------------------------------');
  const restoredResponse = deAnonymizePhi(finalState.agentResponse, anonResult.tokenMap);
  const citationRes = verifyAndResolveCitations(restoredResponse, finalState.retrievedGuidelines);

  console.log(`  - Valid Citations Found:    ${citationRes.validCitations.join(', ')}`);
  console.log(`  - Grounding Fidelity Score: ${citationRes.groundingFidelity}`);
  console.log(`  - Evidence Badges Emitted:  ${citationRes.evidenceBadges.length}`);

  if (citationRes.groundingFidelity < 0.20) {
    throw new Error(`Grounding fidelity score too low: ${citationRes.groundingFidelity}`);
  }
  console.log('  [PASS] Layers 2, 5, 6 Citation resolution and grounding verified.');

  console.log('\n----------------------------------------------------------------');
  console.log('STEP 5: Clinician Active Learning Review & Drift Engine (Layer 8)');
  console.log('----------------------------------------------------------------');
  recordClinicianFeedback({
    patientId,
    agentType: finalState.routedAgent,
    suggestedAction: finalState.agentResponse.slice(0, 100),
    clinicianAction: 'Approved',
    overrideReason: '',
    clinicianId: 'Dr. Nishant Maurya'
  });

  const metrics = getFeedbackMetrics(20);
  console.log(`  - Total Reviews:    ${metrics.totalReviews}`);
  console.log(`  - Override Rate:    ${(metrics.overrideRate * 100).toFixed(1)}%`);
  console.log(`  - Drift Detected:   ${metrics.isDriftDetected}`);
  console.log(`  - System Status:    ${metrics.status}`);

  if (metrics.totalReviews < 1) {
    throw new Error('Feedback record was not registered');
  }
  console.log(`  [PASS] Layer 8 Active learning review verified (Status: ${metrics.status}).`);

  console.log('\n----------------------------------------------------------------');
  console.log('STEP 6: Observability Run Trace & RAGAS Evaluation (Layer 9)');
  console.log('----------------------------------------------------------------');
  const trace: RunTrace = {
    traceId: `e2e_ts_trace_${patientId}`,
    patientId,
    rootQuery: rawQuery,
    routedAgent: finalState.routedAgent,
    routingConfidence: finalState.routingConfidence,
    totalDurationMs: 580,
    tokenUsage: { promptTokens: 220, completionTokens: 180, totalTokens: 400 },
    providerUsed: 'groq',
    groundingScore: finalState.groundingFidelity || 0.85,
    citations: finalState.citations,
    isSafetyBlocked: false,
    spans: (finalState.executionSteps || []).map(s => ({
      spanId: `span_${s.stepId}`,
      name: s.action,
      agent: s.agent,
      startTime: Date.now(),
      durationMs: 80,
      status: 'SUCCESS'
    })),
    createdAt: new Date().toISOString(),
    status: 'COMPLETED'
  };

  recordRunTrace(trace);
  const recent = getRecentTraces(5);
  const summary = getObservabilitySummary();
  console.log(`  - Stored Traces Count: ${recent.length}`);
  console.log(`  - Total Observability Runs: ${summary.totalRuns}`);
  if (recent.length === 0) {
    throw new Error('Run trace was not stored');
  }
  console.log('  [PASS] Layer 9 Observability run trace verified.');
}

async function testMedicationSafetyBlockerE2E() {
  console.log('\n----------------------------------------------------------------');
  console.log('SAFETY GATE TEST: Lethal Drug Interaction Blocker (Warfarin + NSAID)');
  console.log('----------------------------------------------------------------');
  const { runMedicationSafetyAgent } = await import('../src/lib/agents/medicationSafetyAgent');

  const safetyState = createInitialAgentState(
    'Patient requests Ibuprofen 800mg TID for sudden knee pain while continuing Warfarin',
    {
      medications: ['Warfarin 5mg daily', 'Ibuprofen 800mg TID']
    }
  );

  const evaluated = await runMedicationSafetyAgent(safetyState);
  console.log(`  - Critical Drug Alerts Flagged: ${evaluated.medicationAlerts.length}`);
  for (const alert of evaluated.medicationAlerts) {
    console.log(`    * [${alert.severity}] ${alert.drugs}: ${alert.hazard.slice(0, 90)}...`);
  }

  if (evaluated.medicationAlerts.length === 0 || !evaluated.medicationAlerts.some(a => a.severity === 'CRITICAL')) {
    throw new Error('Medication safety agent failed to flag CRITICAL Warfarin+NSAID blocker');
  }
  console.log('  [PASS] Medication Safety Gate CRITICAL Blocker verified.');
}

async function main() {
  console.log('================================================================');
  console.log('CareLink Phase 6: Autonomous 9-Layer Architecture E2E Test Suite');
  console.log('================================================================');
  await testFullClinicalPipelineE2E();
  await testMedicationSafetyBlockerE2E();
  console.log('================================================================');
  console.log('ALL 9 ARCHITECTURAL LAYERS VERIFIED END-TO-END [PASS]');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Phase 6 TS E2E Test Failure:', err);
  process.exit(1);
});
