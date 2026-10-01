/**
 * CareLink Autonomous Real-Time Vitals Alert Agent (TypeScript)
 * Background physiological monitoring engine detecting acute deterioration in telemetry streams.
 * Automatically triggers emergency triage escalations on simulated SpO2/BP crashes.
 */

export interface TelemetryVitals {
  patientId: string;
  patientName?: string;
  spo2: number;
  heartRate: number;
  systolic: number;
  diastolic: number;
  temperature: number;
  weightGainKg?: number;
  timestamp: string;
}

export interface VitalsAlertEvent {
  alertId: string;
  patientId: string;
  patientName: string;
  severity: "EMERGENCY" | "WARNING" | "NORMAL";
  vitalType: "SPO2" | "BLOOD_PRESSURE" | "HEART_RATE" | "TEMPERATURE" | "MULTIPLE";
  readingSummary: string;
  clinicalSignificance: string;
  immediateAction: string;
  escalationWindow: string;
  isSimulatedDrop: boolean;
  timestamp: string;
}

/**
 * Evaluates live telemetry stream for acute physiological deterioration
 */
export function evaluateTelemetryDeterioration(
  telemetry: TelemetryVitals
): VitalsAlertEvent | null {
  const { spo2, heartRate, systolic, diastolic, temperature, patientId, patientName } = telemetry;
  const name = patientName || patientId;

  // 1. Critical Hypoxemia
  if (spo2 <= 88) {
    return {
      alertId: `alert_spo2_${Date.now()}`,
      patientId,
      patientName: name,
      severity: "EMERGENCY",
      vitalType: "SPO2",
      readingSummary: `Critical Hypoxemia: SpO2 dropped to ${spo2}% (Normal: >= 95%)`,
      clinicalSignificance: "Acute respiratory failure / rapid pulmonary decompensation detected.",
      immediateAction: "Initiate high-flow supplemental oxygen (10-15 L/min non-rebreather mask), notify attending intensivist, and prepare for emergent airway management [WHO-SEPSIS-01].",
      escalationWindow: "IMMEDIATE (< 5 minutes)",
      isSimulatedDrop: false,
      timestamp: new Date().toISOString()
    };
  }

  // 2. Hypertensive Crisis or Severe Hypotension / Shock
  if (systolic >= 180 || diastolic >= 120) {
    return {
      alertId: `alert_bp_${Date.now()}`,
      patientId,
      patientName: name,
      severity: "EMERGENCY",
      vitalType: "BLOOD_PRESSURE",
      readingSummary: `Hypertensive Crisis: BP ${systolic}/${diastolic} mmHg (Threshold: >= 180/120)`,
      clinicalSignificance: "Impending target organ damage (stroke, acute pulmonary edema, aortic dissection).",
      immediateAction: "Immediate IV antihypertensive titration (IV Labetalol or Nicardipine) and continuous arterial line monitoring [AHA-HTN-01].",
      escalationWindow: "IMMEDIATE (< 15 minutes)",
      isSimulatedDrop: false,
      timestamp: new Date().toISOString()
    };
  }

  if (systolic <= 90) {
    return {
      alertId: `alert_shock_${Date.now()}`,
      patientId,
      patientName: name,
      severity: "EMERGENCY",
      vitalType: "BLOOD_PRESSURE",
      readingSummary: `Severe Hypotension: SBP ${systolic} mmHg (Shock state: <= 90 mmHg)`,
      clinicalSignificance: "Cardiogenic or septic shock state with compromised organ perfusion.",
      immediateAction: "Initiate IV crystalloid fluid challenge and prepare inotrope/vasopressor infusion [WHO-SEPSIS-01].",
      escalationWindow: "IMMEDIATE (< 10 minutes)",
      isSimulatedDrop: false,
      timestamp: new Date().toISOString()
    };
  }

  // 3. Mild-to-moderate deterioration
  if (spo2 < 92) {
    return {
      alertId: `alert_spo2_mild_${Date.now()}`,
      patientId,
      patientName: name,
      severity: "WARNING",
      vitalType: "SPO2",
      readingSummary: `Moderate Hypoxemia: SpO2 ${spo2}% (Range: 88-91%)`,
      clinicalSignificance: "Early decompensation; risk of further desaturation.",
      immediateAction: "Apply low-flow nasal cannula (2-4 L/min), auscultate lung bases for rales, and repeat arterial blood gas [ICMR-HF-01].",
      escalationWindow: "< 30 minutes",
      isSimulatedDrop: false,
      timestamp: new Date().toISOString()
    };
  }

  return null;
}

/**
 * Triggers a simulated acute vitals deterioration event for demo evaluation
 */
export function simulateVitalsDeterioration(
  patientId = "patient_sunita_91",
  anomalyType: "hypoxemia" | "hypertensive_crisis" | "shock" = "hypoxemia"
): { telemetry: TelemetryVitals; alert: VitalsAlertEvent } {
  let telemetry: TelemetryVitals;

  switch (anomalyType) {
    case "hypertensive_crisis":
      telemetry = {
        patientId,
        patientName: "Sunita Sharma (MRN-91042)",
        spo2: 95,
        heartRate: 112,
        systolic: 194,
        diastolic: 122,
        temperature: 98.6,
        timestamp: new Date().toISOString()
      };
      break;

    case "shock":
      telemetry = {
        patientId,
        patientName: "Sunita Sharma (MRN-91042)",
        spo2: 91,
        heartRate: 128,
        systolic: 82,
        diastolic: 48,
        temperature: 101.8,
        timestamp: new Date().toISOString()
      };
      break;

    case "hypoxemia":
    default:
      telemetry = {
        patientId,
        patientName: "Sunita Sharma (MRN-91042)",
        spo2: 88,
        heartRate: 118,
        systolic: 154,
        diastolic: 94,
        temperature: 98.4,
        timestamp: new Date().toISOString()
      };
      break;
  }

  const alert = evaluateTelemetryDeterioration(telemetry)!;
  alert.isSimulatedDrop = true;

  return { telemetry, alert };
}
