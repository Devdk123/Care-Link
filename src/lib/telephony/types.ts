/**
 * CareLink LiveKit Telephony & Critical Escalation Types
 * Track 2: Closed-Loop Telephony & Indic Voice Escalation
 */

export type CallStatus =
  | 'QUEUED'
  | 'INITIATED'
  | 'RINGING'
  | 'IN_PROGRESS'
  | 'ACKNOWLEDGED'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'FAILED'
  | 'ESCALATION_FAILED';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type AlertType =
  | 'CRITICAL_HYPOXIA'
  | 'ACUTE_SPO2_DROP'
  | 'LETHAL_DDI'
  | 'CODE_BLUE'
  | 'BRADYCARDIA_ALERT'
  | 'TACHYCARDIA_ALERT';

export interface VitalsTelemetry {
  spo2: number;
  heartRate?: number;
  bloodPressure?: string;
  respiratoryRate?: number;
  timestamp?: string;
}

export interface CriticalAlertPayload {
  alertId: string;
  patientId: string;
  caseId: string;
  ward: string;
  bed: string;
  alertType: AlertType;
  severity: AlertSeverity;
  vitals: VitalsTelemetry;
  primaryContact: string; // E.164 phone number, e.g. "+919876543210"
  secondaryContact?: string;
  clinicianRole?: string; // e.g. "Duty ICU Registrar"
  preferredLanguage?: string; // e.g. "en-IN", "hi-IN", "ta-IN", etc.
  triggerReason?: string;
  dispatchedAt?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  notes?: string;
}

export interface VoiceEscalationMetadata {
  alertId: string;
  caseId: string;
  ward: string;
  bed: string;
  alertType: string;
  spo2: number;
  heartRate?: number;
  telephonyMode: 'live' | 'mock';
  issuedAt: string;
  preferredLanguage: string;
  cooldownWindowSec: number;
}

export interface TimelineEvent {
  timestamp: string;
  status: CallStatus;
  message: string;
  actor?: string;
  data?: any;
}

export interface CallRecord {
  callId: string;
  alertId: string;
  caseId: string;
  ward: string;
  bed: string;
  roomName: string;
  dispatchId?: string;
  sipParticipantId?: string;
  destinationNumber: string;
  status: CallStatus;
  attemptNumber: number;
  maxAttempts: number;
  initiatedAt: string;
  answeredAt?: string;
  acknowledgedAt?: string;
  endedAt?: string;
  verbalAckSnippet?: string;
  audioRecordingUrl?: string;
  error?: string;
  isMock: boolean;
  timeline: TimelineEvent[];
}

/**
 * Strips direct patient identifiers (Names, MRNs, Addresses, Phone Numbers)
 * from the voice dispatch payload. Telephony signaling MUST only contain
 * minimum necessary operational tokens: caseId, ward, bed, alertType, and vitals.
 */
export function sanitizeAlertForVoice(alert: CriticalAlertPayload): VoiceEscalationMetadata {
  if (!alert.alertId || !alert.caseId) {
    throw new Error('Invalid alert payload: alertId and caseId are mandatory.');
  }

  const spo2Val = typeof alert.vitals?.spo2 === 'number' ? alert.vitals.spo2 : 0;
  if (spo2Val < 0 || spo2Val > 100) {
    throw new Error(`Invalid SpO2 level: ${spo2Val}%`);
  }

  return {
    alertId: alert.alertId,
    caseId: alert.caseId,
    ward: alert.ward || 'General Ward',
    bed: alert.bed || 'Unassigned Bed',
    alertType: alert.alertType,
    spo2: spo2Val,
    heartRate: alert.vitals?.heartRate,
    telephonyMode: (process.env.TELEPHONY_MODE === 'live' ? 'live' : 'mock'),
    issuedAt: new Date().toISOString(),
    preferredLanguage: alert.preferredLanguage || 'en-IN',
    cooldownWindowSec: Number(process.env.TELEPHONY_COOLDOWN_SEC) || 300,
  };
}
