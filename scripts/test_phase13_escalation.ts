/**
 * Phase 13 Verification Suite: Closed-Loop Critical Escalation Engine & Call Policy
 * 
 * Verifies:
 * 1. Critical-Only Policy Gate (blocks non-critical SpO2/severity)
 * 2. Active Call Idempotency Lock (blocks simultaneous duplicate dialing)
 * 3. Closed-Loop Lifecycle (QUEUED -> INITIATED -> RINGING -> IN_PROGRESS -> ACKNOWLEDGED)
 * 4. Audit Timeline Events with timestamps and actors
 * 5. Cooldown Window Protection (300 seconds)
 * 6. Escalation Retry Ladder & Secondary Failover (Attempt 1 -> Attempt 2 -> ESCALATION_FAILED)
 * 7. E.164 Phone Number Normalization
 */

import {
  callPolicy,
  escalationService,
  CriticalAlertPayload,
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

async function runPhase13Tests() {
  console.log('\n=============================================================');
  console.log('📞 CareLink Escalation Engine — Phase 13 Verification Suite');
  console.log('=============================================================\n');

  // Clear previous records for test isolation
  escalationService.clearStore();

  // Test 1: Phone Normalization
  console.log('Test 1: Phone Normalization (E.164)');
  assert(callPolicy.normalizeE164('9876543210') === '+919876543210', 'Normalized 10-digit Indian mobile to E.164');
  assert(callPolicy.normalizeE164('+919876543210') === '+919876543210', 'Preserved valid E.164 format');
  assert(callPolicy.normalizeE164('919876543210') === '+919876543210', 'Normalized 12-digit Indian format');

  // Test 2: Gate 1 - Severity & Physiological Criticality Gate
  console.log('\nTest 2: Gate 1 — Critical-Only Gate');
  const nonCriticalAlert: CriticalAlertPayload = {
    alertId: 'ALT-ROUTINE-1',
    patientId: 'PT-101',
    caseId: 'CASE-STABLE-1',
    ward: 'General Ward A',
    bed: 'Bed-02',
    alertType: 'ROUTINE_TELEMETRY' as any,
    severity: 'INFO',
    vitals: { spo2: 98, heartRate: 72 },
    primaryContact: '+919876543210',
  };

  const nonCritRes = await escalationService.placeEscalationCall(nonCriticalAlert);
  assert(nonCritRes.success === false, 'Blocked non-critical alert from voice escalation');
  assert(nonCritRes.validation.reason === 'SEVERITY_NOT_CRITICAL', 'Reason correctly identified as SEVERITY_NOT_CRITICAL');

  // Test 3: Legitimate Critical Hypoxia Escalation
  console.log('\nTest 3: Critical Hypoxia Alert Dispatch & Lifecycle');
  const acuteCriticalAlert: CriticalAlertPayload = {
    alertId: 'ALT-HYPOXIA-401',
    patientId: 'PT-4019',
    caseId: 'CASE-HYPOXIA-401',
    ward: 'ICU-2',
    bed: 'Bed-04',
    alertType: 'CRITICAL_HYPOXIA',
    severity: 'CRITICAL',
    vitals: { spo2: 83, heartRate: 122 },
    primaryContact: '+919876543210',
    secondaryContact: '+919876543211',
  };

  const criticalRes = await escalationService.placeEscalationCall(acuteCriticalAlert, {
    autoSimulate: false, // Manual lifecycle test
  });

  assert(criticalRes.success === true, 'Critical escalation initiated successfully');
  assert(Boolean(criticalRes.callRecord), 'Call record generated');
  assert(criticalRes.callRecord?.status === 'RINGING', 'Initial call status transitioned to RINGING');
  assert(Boolean(criticalRes.callRecord?.dispatchId), 'LiveKit Voice Agent dispatch ID recorded');
  assert(Boolean(criticalRes.callRecord?.sipParticipantId), 'LiveKit SIP participant ID recorded');

  const activeCallId = criticalRes.callRecord!.callId;

  // Test 4: Gate 2 - Active Call Idempotency Lock
  console.log('\nTest 4: Gate 2 — Active Call Idempotency Lock');
  const duplicateRes = await escalationService.placeEscalationCall(acuteCriticalAlert);
  assert(duplicateRes.success === false, 'Duplicate concurrent call suppressed');
  assert(duplicateRes.validation.reason === 'ACTIVE_CALL_IN_PROGRESS', 'Idempotency reason is ACTIVE_CALL_IN_PROGRESS');
  assert(duplicateRes.validation.activeCallId === activeCallId, 'Matches current active call ID');

  // Test 5: Closed-Loop Clinician Pickup & Acknowledgement
  console.log('\nTest 5: Closed-Loop Lifecycle & Verbal Acknowledgement');
  escalationService.transitionToInProgress(activeCallId);
  const inProgressCall = escalationService.getCall(activeCallId);
  assert(inProgressCall?.status === 'IN_PROGRESS', 'Call transitioned to IN_PROGRESS on clinician pickup');

  const ackCall = escalationService.acknowledgeCall(activeCallId, {
    acknowledgedBy: 'Dr. Sharma (Duty Intensivist)',
    verbalSnippet: 'Understood, SpO2 83% noted. Initiating 100% non-rebreather mask and STAT blood gas.',
  });

  assert(ackCall.status === 'ACKNOWLEDGED', 'Call status reached closed-loop ACKNOWLEDGED');
  assert(Boolean(ackCall.acknowledgedAt), 'Acknowledgement timestamp recorded');
  assert(ackCall.verbalAckSnippet?.includes('SpO2 83%'), 'Verbal acknowledgement snippet preserved');

  // Test 6: Audit Timeline Integrity
  console.log('\nTest 6: Audit Timeline Event Verification');
  const timeline = ackCall.timeline;
  assert(timeline.length >= 4, `Timeline contains ${timeline.length} progressive events (expected >= 4)`);
  assert(timeline.some((e) => e.status === 'QUEUED'), 'Timeline contains QUEUED event');
  assert(timeline.some((e) => e.status === 'INITIATED'), 'Timeline contains INITIATED event');
  assert(timeline.some((e) => e.status === 'RINGING'), 'Timeline contains RINGING event');
  assert(timeline.some((e) => e.status === 'IN_PROGRESS'), 'Timeline contains IN_PROGRESS event');
  assert(timeline.some((e) => e.status === 'ACKNOWLEDGED'), 'Timeline contains ACKNOWLEDGED event');

  // Test 7: Gate 3 - Cooldown Window Protection
  console.log('\nTest 7: Gate 3 — Cooldown Window Protection');
  const cooldownTestRes = await escalationService.placeEscalationCall(acuteCriticalAlert);
  assert(cooldownTestRes.success === false, 'Blocked immediate re-dial during cooldown window');
  assert(cooldownTestRes.validation.reason === 'COOLDOWN_ACTIVE', 'Reason is COOLDOWN_ACTIVE');
  assert(
    typeof cooldownTestRes.validation.remainingCooldownSec === 'number' &&
      cooldownTestRes.validation.remainingCooldownSec > 0,
    'Remaining cooldown seconds calculated'
  );

  // Test 8: Forced Cooldown Bypass for Acute Deterioration
  console.log('\nTest 8: Forced Cooldown Bypass for Critical Crash');
  const bypassRes = await escalationService.placeEscalationCall(
    {
      ...acuteCriticalAlert,
      alertId: 'ALT-HYPOXIA-401-CRASH',
      vitals: { spo2: 76 }, // Acute crash
    },
    { forceBypassCooldown: true, autoSimulate: false }
  );
  assert(bypassRes.success === true, 'Cooldown successfully bypassed for acute crash');

  // Test 9: Gate 4 & Escalation Ladder (Failover to Secondary Contact)
  console.log('\nTest 9: Escalation Ladder & Secondary Contact Failover');
  const crashCallId = bypassRes.callRecord!.callId;
  const failoverRes = await escalationService.recordCallFailure(
    crashCallId,
    'NO_ANSWER',
    'Clinician phone unanswered after 30s'
  );

  assert(failoverRes.previousCall.status === 'NO_ANSWER', 'First call marked as NO_ANSWER');
  assert(failoverRes.retryInitiated === true, 'Retry automatically initiated for Attempt 2');
  assert(Boolean(failoverRes.nextCall), 'Second call record generated');
  assert(failoverRes.nextCall?.attemptNumber === 2, 'Next call is Attempt 2/2');
  assert(
    failoverRes.nextCall?.destinationNumber === '+919876543211',
    'Attempt 2 dialed secondary contact (+919876543211)'
  );

  // Test 10: Exhaustion of Ladder -> ESCALATION_FAILED
  console.log('\nTest 10: Max Attempts Exhaustion -> ESCALATION_FAILED');
  const secondCallId = failoverRes.nextCall!.callId;
  const exhaustionRes = await escalationService.recordCallFailure(
    secondCallId,
    'NO_ANSWER',
    'Secondary clinician also unanswered'
  );

  assert(exhaustionRes.retryInitiated === false, 'No further telephony retries allowed');
  const finalCall = escalationService.getCall(secondCallId);
  assert(
    finalCall?.timeline.some((e) => e.status === 'ESCALATION_FAILED'),
    'ESCALATION_FAILED event recorded in timeline to trigger Code Blue broadcast'
  );

  console.log('\n=============================================================');
  console.log(`🎉 PHASE 13 VERIFICATION COMPLETE: ${testsPassed}/${testsTotal} TESTS PASSED (100%)`);
  console.log('=============================================================\n');
}

runPhase13Tests().catch((err) => {
  console.error('Fatal error during Phase 13 tests:', err);
  process.exit(1);
});
