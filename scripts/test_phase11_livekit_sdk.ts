/**
 * Phase 11 Verification Suite: LiveKit Telephony SDK & Client Adapter
 * 
 * Tests:
 * 1. Client initialization and mock fallback
 * 2. Deterministic room naming
 * 3. PHI Sanitization for voice dispatch signaling
 * 4. Agent dispatch creation
 * 5. Outbound SIP participant dialing
 * 6. AccessToken generation
 * 7. End-to-end call lifecycle simulation
 * 8. Clinical safety validation on bad payloads
 */

import {
  LiveKitTelephonyClient,
  livekitTelephonyClient,
  sanitizeAlertForVoice,
  CriticalAlertPayload,
  CallStatus,
} from '../src/lib/telephony';

let testsPassed = 0;
let testsTotal = 0;

function assert(condition: boolean, testName: string, extraInfo?: string) {
  testsTotal++;
  if (condition) {
    testsPassed++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}${extraInfo ? ` — ${extraInfo}` : ''}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

async function runPhase11Tests() {
  console.log('\n=============================================================');
  console.log('🎙️ CareLink Telephony Track 2 — Phase 11 Verification Suite');
  console.log('=============================================================\n');

  // Test 1: Adapter Initialization & Configuration
  console.log('Test 1: Adapter Initialization & Config Summary');
  const summary = livekitTelephonyClient.getConfigSummary();
  assert(typeof summary === 'object', 'Config summary returns valid object');
  assert(summary.telephonyMode === 'mock' || summary.telephonyMode === 'live', 'Telephony mode is valid');
  assert(summary.agentName === 'carelink-escalation-agent', 'Voice agent name matches PRD spec');
  assert(summary.maxAttempts === 2, 'Default max escalation attempts is 2');
  assert(summary.cooldownSec === 300, 'Default escalation cooldown is 300 seconds');

  // Test 2: Deterministic Room Naming
  console.log('\nTest 2: Deterministic Room Naming');
  const roomName1 = livekitTelephonyClient.getDeterministicRoomName('ALERT-SPO2-88');
  assert(roomName1 === 'carelink-alert-ALERT-SPO2-88', 'Deterministic room naming matches convention');
  const roomName2 = livekitTelephonyClient.getDeterministicRoomName('ALERT/INVALID#CHAR$99');
  assert(!roomName2.includes('#') && !roomName2.includes('$') && !roomName2.includes('/'), 'Special characters sanitized in room name');

  // Test 3: PHI Scrubbing / Minimum-Necessary Voice Signaling
  console.log('\nTest 3: PHI Scrubbing & Minimum Necessary Telephony Metadata');
  const rawAlert: CriticalAlertPayload = {
    alertId: 'ALT-9042',
    patientId: 'PT-SECRET-4401',
    caseId: 'CASE-HYPOXIA-9042',
    ward: 'ICU-3',
    bed: 'Bed-12',
    alertType: 'CRITICAL_HYPOXIA',
    severity: 'CRITICAL',
    vitals: {
      spo2: 84,
      heartRate: 118,
      bloodPressure: '140/92',
    },
    primaryContact: '+919876543210',
    preferredLanguage: 'hi-IN',
    notes: 'Patient Rajesh Kumar has severe dyspnea and prior MI',
  };

  const sanitized = sanitizeAlertForVoice(rawAlert);
  assert(sanitized.alertId === 'ALT-9042', 'Alert ID preserved');
  assert(sanitized.caseId === 'CASE-HYPOXIA-9042', 'Case ID preserved');
  assert(sanitized.ward === 'ICU-3', 'Ward preserved');
  assert(sanitized.bed === 'Bed-12', 'Bed preserved');
  assert(sanitized.spo2 === 84, 'SpO2 vitals preserved');
  assert(sanitized.heartRate === 118, 'Heart rate vitals preserved');
  assert(sanitized.preferredLanguage === 'hi-IN', 'Preferred language preserved');
  // Verify no PHI leakage in voice metadata
  const stringified = JSON.stringify(sanitized);
  assert(!stringified.includes('Rajesh Kumar'), 'Patient Name scrubbed from voice metadata');
  assert(!stringified.includes('+919876543210'), 'Direct contact scrubbed from voice metadata payload');
  assert(!stringified.includes('PT-SECRET-4401'), 'Internal Patient MRN scrubbed from voice metadata');

  // Test 4: Agent Outbound Dispatch Creation
  console.log('\nTest 4: Agent Outbound Dispatch Creation');
  const dispatch = await livekitTelephonyClient.createOutboundEscalationDispatch(
    'carelink-alert-ALT-9042',
    sanitized
  );
  assert(Boolean(dispatch.dispatchId), 'Dispatch ID generated');
  assert(dispatch.roomName === 'carelink-alert-ALT-9042', 'Room name matches');
  assert(dispatch.agentName === 'carelink-escalation-agent', 'Agent name matches');
  assert(dispatch.isMock === true || dispatch.isMock === false, 'isMock flag present');

  // Test 5: Outbound SIP Participant Dialing
  console.log('\nTest 5: Outbound SIP Participant Dialing');
  const sipResult = await livekitTelephonyClient.createSipParticipantCall(
    '+919876543210',
    'carelink-alert-ALT-9042'
  );
  assert(Boolean(sipResult.participantId), 'SIP Participant ID generated');
  assert(sipResult.destination === '+919876543210', 'Destination phone number recorded');
  assert(sipResult.status === 'RINGING' || sipResult.status === 'FAILED', 'Initial call status is RINGING or FAILED');

  // Test 6: AccessToken Generation for Cockpit Monitoring
  console.log('\nTest 6: LiveKit Room Access Token Generation');
  const token = await livekitTelephonyClient.generateRoomToken(
    'carelink-alert-ALT-9042',
    'cockpit-observer-1',
    'Dr. Observability'
  );
  assert(typeof token === 'string' && token.split('.').length === 3, 'Returns valid 3-part JWT token');

  // Test 7: Simulated Mock Call Lifecycle & Verbal Ack
  console.log('\nTest 7: Full Call Lifecycle Simulation');
  const statusHistory: CallStatus[] = [];
  const lifecycleResult = await livekitTelephonyClient.simulateMockCallLifecycle(rawAlert, {
    autoAck: true,
    transitionDelayMs: 15,
    onStatusChange: (status) => {
      statusHistory.push(status);
    },
  });

  assert(lifecycleResult.finalStatus === 'ACKNOWLEDGED', 'Call reached final state ACKNOWLEDGED');
  assert(statusHistory.includes('QUEUED'), 'Lifecycle passed through QUEUED');
  assert(statusHistory.includes('INITIATED'), 'Lifecycle passed through INITIATED');
  assert(statusHistory.includes('RINGING'), 'Lifecycle passed through RINGING');
  assert(statusHistory.includes('IN_PROGRESS'), 'Lifecycle passed through IN_PROGRESS');
  assert(statusHistory.includes('ACKNOWLEDGED'), 'Lifecycle passed through ACKNOWLEDGED');
  assert(lifecycleResult.verbalAck.includes('SpO2 84%'), 'Verbal acknowledgement contains SpO2 value');
  assert(lifecycleResult.verbalAck.includes('Dr. Sharma acknowledged'), 'Verbal acknowledgement identifies clinician');

  // Test 8: Clinical Safety on Malformed / Out-of-bounds Payloads
  console.log('\nTest 8: Clinical Safety & Payload Boundary Checks');
  let rejectedNegativeSpO2 = false;
  try {
    sanitizeAlertForVoice({
      ...rawAlert,
      vitals: { spo2: -5 },
    });
  } catch {
    rejectedNegativeSpO2 = true;
  }
  assert(rejectedNegativeSpO2, 'Rejected physiologically impossible negative SpO2');

  let rejectedMissingCaseId = false;
  try {
    sanitizeAlertForVoice({
      ...rawAlert,
      caseId: '',
    });
  } catch {
    rejectedMissingCaseId = true;
  }
  assert(rejectedMissingCaseId, 'Rejected alert with missing caseId');

  console.log('\n=============================================================');
  console.log(`🎉 PHASE 11 VERIFICATION COMPLETE: ${testsPassed}/${testsTotal} TESTS PASSED (100%)`);
  console.log('=============================================================\n');
}

runPhase11Tests().catch((err) => {
  console.error('Fatal error during Phase 11 tests:', err);
  process.exit(1);
});
