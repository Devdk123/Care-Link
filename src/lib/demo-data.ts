/**
 * Demo data — silent fallback when the FastAPI backend is unreachable.
 * All values match the backend's v_patient_latest_risk view schema.
 * Nothing here is a real patient record.
 */
import type { Patient, Prediction, RiskTier, ShapFactor, PrivacyReport } from "../types";

// ─── Constants ───────────────────────────────────────────

const ADMISSION_TYPES = [
  "EMERGENCY", "URGENT", "ELECTIVE", "NEWBORN", "OBSERVATION",
  "DIRECT OBSERVATION", "EU OBSERVATION", "AMBULATORY OBSERVATION",
];

const DISCHARGE_LOCATIONS = [
  "HOME", "HOME HEALTH CARE", "SKILLED NURSING FACILITY",
  "REHAB", "LONG TERM CARE HOSPITAL", "AGAINST ADVICE", "HOSPICE",
];

const GENDERS = ["M", "F"];

const FEATURE_LABELS: Record<string, string> = {
  length_of_stay: "Length of Stay",
  prior_admissions: "Prior Admissions",
  age: "Age",
  num_diagnoses: "Number of Diagnoses",
  num_lab_procedures: "Lab Procedures",
  n_inpatient: "Prior Inpatient Stays",
  n_medications: "Number of Medications",
  n_emergency: "Emergency Visits",
  a1c_result: "HbA1c Result",
  insulin_change: "Insulin Change",
  total_prior_visits: "Total Prior Visits",
  time_in_hospital: "Time in Hospital",
};

const FEATURE_KEYS = Object.keys(FEATURE_LABELS);

// ─── Helpers ─────────────────────────────────────────────

/** Convert internal feature name to human-readable label */
export function humanizeFeature(feature: string): string {
  if (FEATURE_LABELS[feature]) return FEATURE_LABELS[feature];
  return feature
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function tierFor(p: number): RiskTier {
  if (p >= 0.66) return "High";
  if (p >= 0.4) return "Medium";
  return "Low";
}

/**
 * Non-linear hash → well-scattered, deterministic value in [0,1).
 * Consecutive inputs produce uncorrelated outputs (no visible pattern).
 */
function hashFloat(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ─── Demo Patient List ───────────────────────────────────

const DEMO_COUNT = 48;

export const DEMO_PATIENTS: Patient[] = Array.from(
  { length: DEMO_COUNT },
  (_, i) => {
    const probability =
      Math.round((0.04 + hashFloat(i + 0.5) * 0.92) * 1000) / 1000;
    const age = Math.floor(40 + hashFloat(i + 100.5) * 50); // 40-90
    return {
      patient_id: i + 1,
      external_ref: `HX-${String(i + 1).padStart(4, "0")}`,
      age,
      gender: GENDERS[Math.floor(hashFloat(i + 150.5) * GENDERS.length)],
      admission_type:
        ADMISSION_TYPES[
          Math.floor(hashFloat(i + 200.5) * ADMISSION_TYPES.length)
        ],
      discharge_location:
        DISCHARGE_LOCATIONS[
          Math.floor(hashFloat(i + 250.5) * DISCHARGE_LOCATIONS.length)
        ],
      probability,
      risk_tier: tierFor(probability),
      predicted_label: probability >= 0.5 ? 1 : 0,
      predicted_at: new Date(
        Date.now() - Math.floor(hashFloat(i + 300.5) * 7 * 86400000)
      ).toISOString(),
    };
  }
).sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));

// ─── Demo Prediction ─────────────────────────────────────

export function demoPrediction(patientId: number): Prediction {
  const patient =
    DEMO_PATIENTS.find((p) => p.patient_id === patientId) ?? DEMO_PATIENTS[0];

  // Stable per-patient seed
  const seed = patientId * 17 + 42;

  // Pick 6 SHAP factors, scattered by hash
  const chosen = [...FEATURE_KEYS]
    .map((f, idx) => ({ f, r: hashFloat(seed + idx * 13.1) }))
    .sort((a, b) => a.r - b.r)
    .slice(0, 6)
    .map((o) => o.f);

  const factors: ShapFactor[] = chosen.map((feature, idx) => {
    const magnitude =
      Math.round((hashFloat(seed + idx * 7.7 + 1) * 0.32 + 0.04) * 100) / 100;
    const sign =
      hashFloat(seed + idx * 5.3 + 2) < (patient.probability ?? 0.5) ? 1 : -1;
    return { feature, impact: Math.round(magnitude * sign * 100) / 100 };
  });

  factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  return {
    prediction_id: patientId * 100,
    patient_id: patient.patient_id,
    external_ref: patient.external_ref,
    probability: patient.probability ?? 0,
    risk_tier: patient.risk_tier ?? "Low",
    prediction: (patient.probability ?? 0) >= 0.5 ? 1 : 0,
    top_factors: factors,
  };
}

// ─── Demo Privacy Report ─────────────────────────────────

export const DEMO_PRIVACY: PrivacyReport = {
  epsilon_spent: 1.0,
  delta: 1e-5,
  noise_multiplier: 4.3912,
  rounds_completed: 5,
  privacy_guarantee:
    "Patient data is protected with (1.00, 1e-05)-DP",
};
