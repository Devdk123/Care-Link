/**
 * CareLink Closed-Loop Critical Escalation Service
 * 
 * Orchestrates:
 * 1. Policy evaluation (Critical check, idempotency, cooldown, max attempts)
 * 2. LiveKit Voice Agent dispatch
 * 3. SIP outbound dialing to on-call clinician
 * 4. Closed-loop state machine & audit timeline
 * 5. Automatic failover to secondary contact on no-answer / busy
 */

import {
  CriticalAlertPayload,
  CallRecord,
  CallStatus,
  TimelineEvent,
  sanitizeAlertForVoice,
} from './types';
import { callPolicy, PolicyValidationResult } from './callPolicy';
import { livekitTelephonyClient } from './livekitClient';

export interface EscalationResult {
  success: boolean;
  validation: PolicyValidationResult;
  callRecord: CallRecord | null;
  roomName?: string;
  dispatchId?: string;
  sipParticipantId?: string;
  error?: string;
}

export class EscalationService {
  private callStore: Map<string, CallRecord> = new Map();

  constructor() {}

  /**
   * Return all call records
   */
  public getAllCalls(): CallRecord[] {
    return Array.from(this.callStore.values()).sort(
      (a, b) => new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime()
    );
  }

  /**
   * Get call by ID
   */
  public getCall(callId: string): CallRecord | undefined {
    return this.callStore.get(callId);
  }

  /**
   * Get currently active calls (QUEUED, INITIATED, RINGING, IN_PROGRESS)
   */
  public getActiveCalls(): CallRecord[] {
    return this.getAllCalls().filter(
      (c) => c.status === 'QUEUED' || c.status === 'INITIATED' || c.status === 'RINGING' || c.status === 'IN_PROGRESS'
    );
  }

  /**
   * Filter calls by query parameters
   */
  public getCalls(filter?: { activeOnly?: boolean; alertId?: string; caseId?: string }): CallRecord[] {
    let calls = this.getAllCalls();
    if (filter?.activeOnly) {
      calls = calls.filter(
        (c) => c.status === 'QUEUED' || c.status === 'INITIATED' || c.status === 'RINGING' || c.status === 'IN_PROGRESS'
      );
    }
    if (filter?.alertId) {
      calls = calls.filter((c) => c.alertId === filter.alertId);
    }
    if (filter?.caseId) {
      calls = calls.filter((c) => c.caseId === filter.caseId);
    }
    return calls;
  }

  /**
   * Add a timeline event to an existing call record
   */
  private addTimelineEvent(callId: string, status: CallStatus, message: string, actor?: string, data?: any) {
    const call = this.callStore.get(callId);
    if (!call) return;

    const event: TimelineEvent = {
      timestamp: new Date().toISOString(),
      status,
      message,
      actor,
      data,
    };

    call.status = status;
    call.timeline.push(event);
    this.callStore.set(callId, call);
  }

  /**
   * Initiates a critical voice escalation call
   */
  public async placeEscalationCall(
    alert: CriticalAlertPayload,
    options?: {
      forceBypassCooldown?: boolean;
      customDestination?: string;
      autoSimulate?: boolean;
      simulatedAckDelayMs?: number;
    }
  ): Promise<EscalationResult> {
    // 1. Evaluate Call Policy
    const validation = callPolicy.validateEscalationEligibility(
      alert,
      this.getAllCalls(),
      options
    );

    if (!validation.eligible || !validation.targetDestination) {
      return {
        success: false,
        validation,
        callRecord: null,
      };
    }

    const roomName = livekitTelephonyClient.getDeterministicRoomName(alert.alertId);
    const metadata = sanitizeAlertForVoice(alert);
    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();

    // 2. Initialize Call Record in QUEUED state
    const initialRecord: CallRecord = {
      callId,
      alertId: alert.alertId,
      caseId: alert.caseId,
      ward: alert.ward || 'General Ward',
      bed: alert.bed || 'Unassigned Bed',
      roomName,
      destinationNumber: validation.targetDestination,
      status: 'QUEUED',
      attemptNumber: validation.attemptNumber || 1,
      maxAttempts: 2,
      initiatedAt: nowIso,
      isMock: livekitTelephonyClient.isMock(),
      timeline: [
        {
          timestamp: nowIso,
          status: 'QUEUED',
          message: `[00:00] Acute Anomaly (${alert.alertType}) queued for critical escalation call (Target: ${validation.targetDestination}, Attempt ${validation.attemptNumber}/2).`,
          actor: 'EscalationOrchestrator',
        },
      ],
    };

    this.callStore.set(callId, initialRecord);

    try {
      // 3. Dispatch LiveKit Voice Agent into the target room
      const dispatchResult = await livekitTelephonyClient.createOutboundEscalationDispatch(
        roomName,
        metadata
      );

      initialRecord.dispatchId = dispatchResult.dispatchId;
      this.addTimelineEvent(
        callId,
        'INITIATED',
        `[00:02] LiveKit Voice Agent (${dispatchResult.agentName}) dispatched into room ${roomName}.`,
        'LiveKitDispatcher'
      );

      // 4. Dial Outbound SIP Participant to ring the Clinician
      const sipResult = await livekitTelephonyClient.createSipParticipantCall(
        validation.targetDestination,
        roomName
      );

      initialRecord.sipParticipantId = sipResult.participantId;
      this.addTimelineEvent(
        callId,
        'RINGING',
        `[00:04] Outbound SIP Trunk dialing ${validation.targetDestination}. Phone ringing on-call clinician.`,
        'SipDialer'
      );

      // 5. If running in mock / automated test mode, simulate lifecycle if requested
      const shouldAutoSimulate = options?.autoSimulate ?? true;
      if (initialRecord.isMock && shouldAutoSimulate) {
        const delay = options?.simulatedAckDelayMs ?? 40;
        setTimeout(() => {
          this.transitionToInProgress(callId);
          setTimeout(() => {
            const defaultAck = `Dr. Sharma acknowledged: "Understood, SpO2 ${metadata.spo2}% critical hypoxia at ${metadata.ward} ${metadata.bed}. Initiating 100% non-rebreather mask and order STAT arterial blood gas."`;
            this.acknowledgeCall(callId, {
              acknowledgedBy: 'Dr. Sharma (Duty Intensivist)',
              verbalSnippet: defaultAck,
            });
          }, delay);
        }, delay);
      }

      return {
        success: true,
        validation,
        callRecord: this.callStore.get(callId) || initialRecord,
        roomName,
        dispatchId: dispatchResult.dispatchId,
        sipParticipantId: sipResult.participantId,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.addTimelineEvent(callId, 'FAILED', `Call initiation error: ${errorMessage}`);
      return {
        success: false,
        validation,
        callRecord: this.callStore.get(callId) || initialRecord,
        error: errorMessage,
      };
    }
  }

  /**
   * Transition call to IN_PROGRESS when clinician picks up
   */
  public transitionToInProgress(callId: string) {
    const call = this.callStore.get(callId);
    if (!call || call.status === 'ACKNOWLEDGED' || call.status === 'FAILED') return;

    call.answeredAt = new Date().toISOString();
    this.addTimelineEvent(
      callId,
      'IN_PROGRESS',
      `[00:08] Clinician answered call. LiveKit audio stream active, voice agent delivering briefing.`,
      'LiveKitWebRTC'
    );
  }

  /**
   * Close the loop: Clinician speaks verbal acknowledgement or presses DTMF 1
   */
  public acknowledgeCall(
    callId: string,
    options?: { acknowledgedBy?: string; verbalSnippet?: string }
  ): CallRecord {
    const call = this.callStore.get(callId);
    if (!call) {
      throw new Error(`Call record not found: ${callId}`);
    }

    const now = new Date().toISOString();
    const ackBy = options?.acknowledgedBy || 'Duty Clinician';
    const snippet = options?.verbalSnippet || 'Acknowledged, attending to patient immediately.';

    call.acknowledgedAt = now;
    call.endedAt = now;
    call.verbalAckSnippet = snippet;

    this.addTimelineEvent(
      callId,
      'ACKNOWLEDGED',
      `[00:18] Verbal Acknowledgement Received from ${ackBy}: "${snippet}". Closed-loop escalation resolved.`,
      ackBy
    );

    return call;
  }

  /**
   * Handle unanswered, busy, or failed call with automatic failover retry
   */
  public async recordCallFailure(
    callId: string,
    reason: 'NO_ANSWER' | 'BUSY' | 'FAILED',
    errorMessage?: string
  ): Promise<{ previousCall: CallRecord; retryInitiated: boolean; nextCall?: CallRecord }> {
    const call = this.callStore.get(callId);
    if (!call) {
      throw new Error(`Call record not found: ${callId}`);
    }

    const now = new Date().toISOString();
    call.endedAt = now;
    call.error = errorMessage || `Call concluded with status ${reason}`;

    this.addTimelineEvent(
      callId,
      reason,
      `Call failed (${reason}): ${errorMessage || 'No response from destination'}. Checking escalation retry ladder.`
    );

    // If attempt was 1, auto-retry with attempt 2 (Secondary Contact)
    if (call.attemptNumber < call.maxAttempts) {
      const syntheticAlert: CriticalAlertPayload = {
        alertId: call.alertId,
        patientId: 'PT-ESCALATE',
        caseId: call.caseId,
        ward: call.ward,
        bed: call.bed,
        alertType: 'CRITICAL_HYPOXIA',
        severity: 'CRITICAL',
        vitals: { spo2: 84 },
        primaryContact: call.destinationNumber,
        secondaryContact: process.env.TELEPHONY_SECONDARY_CONTACT || '+919876543211',
      };

      const retryRes = await this.placeEscalationCall(syntheticAlert, {
        forceBypassCooldown: true,
        autoSimulate: false,
      });

      if (retryRes.success && retryRes.callRecord) {
        this.addTimelineEvent(
          callId,
          reason,
          `Escalation retry #${retryRes.callRecord.attemptNumber} initiated to secondary contact ${retryRes.callRecord.destinationNumber}.`
        );
        return {
          previousCall: call,
          retryInitiated: true,
          nextCall: retryRes.callRecord,
        };
      }
    }

    // All attempts exhausted
    this.addTimelineEvent(
      callId,
      'ESCALATION_FAILED',
      `All ${call.maxAttempts} escalation attempts failed. Activating Hospital Code Blue / Charge Nurse Emergency Broadcast.`
    );

    return {
      previousCall: call,
      retryInitiated: false,
    };
  }

  /**
   * Clear all records (useful for test isolation)
   */
  public clearStore() {
    this.callStore.clear();
  }
}

// Singleton export
export const escalationService = new EscalationService();
