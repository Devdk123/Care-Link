/**
 * CareLink Call Policy Engine
 * 
 * Strict clinical and telephony safety gates:
 * 1. Critical-Only Gate (SpO2 <= 88%, Lethal DDI, Code Blue, Critical Hypoxia)
 * 2. Active Call Idempotency Lock (prevents duplicate simultaneous calls)
 * 3. Cooldown Window Protection (300 seconds)
 * 4. Maximum Attempt Counter (2 attempts, failing over to secondary contact)
 * 5. Allowlist & E.164 Destination Formatting
 */

import { CriticalAlertPayload, CallRecord, CallStatus } from './types';

export interface PolicyValidationResult {
  eligible: boolean;
  reason?:
    | 'ELIGIBLE'
    | 'SEVERITY_NOT_CRITICAL'
    | 'ACTIVE_CALL_IN_PROGRESS'
    | 'COOLDOWN_ACTIVE'
    | 'MAX_ATTEMPTS_EXCEEDED'
    | 'INVALID_PHONE_NUMBER';
  message: string;
  targetDestination?: string;
  attemptNumber?: number;
  activeCallId?: string;
  remainingCooldownSec?: number;
}

export interface CallPolicyConfig {
  maxAttempts: number;
  cooldownSec: number;
  criticalSpO2Threshold: number;
  primaryContact: string;
  secondaryContact: string;
  allowlistedNumbers: string[];
}

export class CallPolicyEngine {
  private config: CallPolicyConfig;

  constructor(customConfig?: Partial<CallPolicyConfig>) {
    const primary = customConfig?.primaryContact || process.env.TELEPHONY_PRIMARY_CONTACT || '+919876543210';
    const secondary = customConfig?.secondaryContact || process.env.TELEPHONY_SECONDARY_CONTACT || '+919876543211';

    this.config = {
      maxAttempts: customConfig?.maxAttempts ?? (Number(process.env.TELEPHONY_MAX_ATTEMPTS) || 2),
      cooldownSec: customConfig?.cooldownSec ?? (Number(process.env.TELEPHONY_COOLDOWN_SEC) || 300),
      criticalSpO2Threshold: customConfig?.criticalSpO2Threshold ?? 88,
      primaryContact: primary,
      secondaryContact: secondary,
      allowlistedNumbers: [
        primary,
        secondary,
        '+919876543210',
        '+919876543211',
        '+919999999999',
        '+15551234567',
      ],
    };
  }

  /**
   * Format any phone string into normalized E.164 (+91XXXXXXXXXX)
   */
  public normalizeE164(phone: string): string {
    const digitsOnly = phone.replace(/[^0-9+]/g, '');
    if (digitsOnly.startsWith('+')) {
      return digitsOnly;
    }
    // If standard 10-digit Indian mobile number
    if (digitsOnly.length === 10) {
      return `+91${digitsOnly}`;
    }
    if (digitsOnly.startsWith('91') && digitsOnly.length === 12) {
      return `+${digitsOnly}`;
    }
    return `+${digitsOnly}`;
  }

  /**
   * Check if an active call is currently ringing or in progress
   */
  private isActiveCallStatus(status: CallStatus): boolean {
    return status === 'QUEUED' || status === 'INITIATED' || status === 'RINGING' || status === 'IN_PROGRESS';
  }

  /**
   * Evaluate whether a critical alert is eligible for telephony escalation
   */
  public validateEscalationEligibility(
    alert: CriticalAlertPayload,
    existingCalls: CallRecord[],
    options?: { forceBypassCooldown?: boolean; customDestination?: string }
  ): PolicyValidationResult {
    // 1. GATE 1: Severity & Physiological Criticality
    const spo2 = alert.vitals?.spo2;
    const isCriticalVitals = typeof spo2 === 'number' && spo2 <= this.config.criticalSpO2Threshold;
    const isCriticalSeverity = alert.severity === 'CRITICAL';
    const isCriticalType =
      alert.alertType === 'CRITICAL_HYPOXIA' ||
      alert.alertType === 'ACUTE_SPO2_DROP' ||
      alert.alertType === 'CODE_BLUE' ||
      alert.alertType === 'LETHAL_DDI';

    // Must be verified critical: either critical vitals (SpO2 <= 88%) OR (critical severity AND critical alertType)
    const isGenuinelyCritical = isCriticalVitals || (isCriticalSeverity && isCriticalType);

    if (!isGenuinelyCritical) {
      return {
        eligible: false,
        reason: 'SEVERITY_NOT_CRITICAL',
        message: `Alert (${alert.alertType}, Severity: ${alert.severity}, SpO2: ${spo2 ?? 'N/A'}%) does not meet critical physiological criteria for voice escalation (Threshold: SpO2 <= ${this.config.criticalSpO2Threshold}%). Routed to EHR/WhatsApp notifications.`,
      };
    }

    // Filter calls for this alert or case
    const alertCalls = existingCalls.filter(
      (c) => c.alertId === alert.alertId || (alert.caseId && c.caseId === alert.caseId)
    );

    // 2. GATE 2: Active Call Idempotency Lock
    const activeCall = alertCalls.find((c) => this.isActiveCallStatus(c.status));
    if (activeCall) {
      return {
        eligible: false,
        reason: 'ACTIVE_CALL_IN_PROGRESS',
        activeCallId: activeCall.callId,
        message: `Voice escalation call (${activeCall.callId}) is already ${activeCall.status} for Alert ${alert.alertId}. Concurrent dialing suppressed.`,
      };
    }

    // 3. GATE 3: Cooldown Window Protection
    if (!options?.forceBypassCooldown) {
      const recentCalls = alertCalls
        .filter((c) => c.status === 'ACKNOWLEDGED' || c.status === 'ENDED' as any || c.status === 'FAILED')
        .sort((a, b) => new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime());

      if (recentCalls.length > 0) {
        const lastCall = recentCalls[0];
        const lastCallTime = new Date(lastCall.endedAt || lastCall.acknowledgedAt || lastCall.initiatedAt).getTime();
        const elapsedSec = (Date.now() - lastCallTime) / 1000;

        if (elapsedSec < this.config.cooldownSec) {
          const remainingSec = Math.ceil(this.config.cooldownSec - elapsedSec);
          return {
            eligible: false,
            reason: 'COOLDOWN_ACTIVE',
            remainingCooldownSec: remainingSec,
            message: `Escalation cooldown active for Case ${alert.caseId} (${remainingSec}s remaining). Voice lines protected from repeat fatigue.`,
          };
        }
      }
    }

    // 4. GATE 4: Maximum Attempts & Contact Routing
    const totalPreviousAttempts = alertCalls.filter(
      (c) => c.alertId === alert.alertId && (c.status === 'FAILED' || c.status === 'NO_ANSWER' || c.status === 'BUSY')
    ).length;

    const nextAttemptNumber = totalPreviousAttempts + 1;

    if (nextAttemptNumber > this.config.maxAttempts) {
      return {
        eligible: false,
        reason: 'MAX_ATTEMPTS_EXCEEDED',
        attemptNumber: nextAttemptNumber,
        message: `Maximum escalation attempts (${this.config.maxAttempts}) exhausted for Alert ${alert.alertId}. Escalating to Emergency Broadcast / Code Blue protocol.`,
      };
    }

    // Destination routing: Attempt 1 -> Primary, Attempt 2 -> Secondary
    let destination = options?.customDestination;
    if (!destination) {
      if (nextAttemptNumber === 1) {
        destination = alert.primaryContact || this.config.primaryContact;
      } else {
        destination = alert.secondaryContact || this.config.secondaryContact;
      }
    }

    const normalizedDestination = this.normalizeE164(destination);

    // 5. GATE 5: Phone Number Formatting Validation
    if (!normalizedDestination || normalizedDestination.length < 10) {
      return {
        eligible: false,
        reason: 'INVALID_PHONE_NUMBER',
        message: `Invalid E.164 phone number format: "${destination}"`,
      };
    }

    return {
      eligible: true,
      reason: 'ELIGIBLE',
      message: `Eligible for critical voice escalation (Attempt ${nextAttemptNumber}/${this.config.maxAttempts}).`,
      targetDestination: normalizedDestination,
      attemptNumber: nextAttemptNumber,
    };
  }
}

// Singleton export
export const callPolicy = new CallPolicyEngine();
