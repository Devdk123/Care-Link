/**
 * CareLink API Layer — Single source of truth for all backend communication.
 * Talks to the FastAPI backend (api.py) running on VITE_ML_API_URL.
 * Falls back to demo data when the backend is unreachable.
 */
import type {
  Patient,
  Prediction,
  FeedbackPayload,
  PrivacyReport,
  TriageResult,
} from "../types";
import { DEMO_PATIENTS, demoPrediction, DEMO_PRIVACY } from "./demo-data";

const BASE = import.meta.env.VITE_ML_API_URL?.replace(/\/$/, "") ?? "";
const TIMEOUT_MS = 6000;

// ─── Helpers ──────────────────────────────────────────────

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function hasBackend(): boolean {
  return Boolean(BASE);
}

// ─── Patients (from /patients → v_patient_latest_risk) ───

function normalizePatient(p: any): Patient {
  return {
    patient_id: Number(p.patient_id),
    external_ref: p.external_ref ?? `HX-${p.patient_id}`,
    age: p.age != null ? Number(p.age) : null,
    gender: p.gender ?? null,
    admission_type: p.admission_type ?? null,
    discharge_location: p.discharge_location ?? null,
    probability: p.probability != null ? Number(p.probability) : null,
    risk_tier: p.risk_tier ?? null,
    predicted_label: p.predicted_label != null ? Number(p.predicted_label) : null,
    predicted_at: p.predicted_at ?? null,
  };
}

export async function getPatients(): Promise<Patient[]> {
  if (!hasBackend()) return DEMO_PATIENTS;
  try {
    const res = await fetchWithTimeout(`${BASE}/patients`);
    if (!res.ok) throw new Error(`patients ${res.status}`);
    const raw = (await res.json()) as any[];
    const data = Array.isArray(raw) ? raw.map(normalizePatient) : [];
    if (data.length === 0) return DEMO_PATIENTS;
    return data;
  } catch {
    return DEMO_PATIENTS;
  }
}

// ─── Predict + SHAP (from /predict/{id}) ─────────────────

export async function getPrediction(patientId: number): Promise<Prediction> {
  if (!hasBackend()) return demoPrediction(patientId);
  try {
    const res = await fetchWithTimeout(`${BASE}/predict/${patientId}`);
    if (!res.ok) throw new Error(`predict ${res.status}`);
    const data = (await res.json()) as any;
    if (!data || !Array.isArray(data.top_factors)) {
      return demoPrediction(patientId);
    }
    return {
      prediction_id: Number(data.prediction_id),
      patient_id: Number(data.patient_id),
      external_ref: data.external_ref ?? `HX-${data.patient_id}`,
      probability: Number(data.probability),
      risk_tier: data.risk_tier,
      prediction: data.prediction,
      top_factors: data.top_factors,
    };
  } catch {
    return demoPrediction(patientId);
  }
}

// ─── Clinician Feedback (POST /feedback) ─────────────────

export async function sendFeedback(payload: FeedbackPayload): Promise<boolean> {
  if (!hasBackend()) return true; // mock success
  try {
    const res = await fetchWithTimeout(`${BASE}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Privacy Report (GET /privacy-report) ────────────────

export async function getPrivacyReport(): Promise<PrivacyReport> {
  if (!hasBackend()) return DEMO_PRIVACY;
  try {
    const res = await fetchWithTimeout(`${BASE}/privacy-report`);
    if (!res.ok) throw new Error(`privacy ${res.status}`);
    return (await res.json()) as PrivacyReport;
  } catch {
    return DEMO_PRIVACY;
  }
}

// ─── Health Check (GET /) ────────────────────────────────

export async function getHealthCheck(): Promise<{ status: string; model_features: number; threshold: number } | null> {
  if (!hasBackend()) return null;
  try {
    const res = await fetchWithTimeout(`${BASE}/`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── AI Triage (via Express server /api/triage) ──────────

export async function callTriage(patient: Patient): Promise<TriageResult> {
  const res = await fetchWithTimeout("/api/triage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      notes: `Patient ${patient.external_ref}, age ${patient.age}, gender ${patient.gender}, admission: ${patient.admission_type}, discharge: ${patient.discharge_location}`,
      vitals: {},
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Triage failed (${res.status}): ${errText}`);
  }

  return res.json() as Promise<TriageResult>;
}

// ─── Utility ─────────────────────────────────────────────

export function getUrgencyColor(level: string): string {
  switch (level.toUpperCase()) {
    case "IMMEDIATE":
      return "text-red-600 bg-red-100 border border-red-200";
    case "URGENT":
      return "text-orange-500 bg-orange-100 border border-orange-200";
    case "SEMI-URGENT":
      return "text-yellow-600 bg-yellow-100 border border-yellow-200";
    case "NON-URGENT":
      return "text-green-600 bg-green-100 border border-green-200";
    default:
      return "text-gray-600 bg-gray-100 border border-gray-200";
  }
}

/** Tier → color map for risk badges/gauges */
export function tierColor(tier: string | null | undefined) {
  switch (tier) {
    case "Low":
      return { text: "text-[#10b981]", bg: "bg-[#10b981]/15", dot: "bg-[#10b981]", ring: "#10B981" };
    case "High":
      return { text: "text-[#ef4444]", bg: "bg-[#ef4444]/15", dot: "bg-[#ef4444]", ring: "#EF4444" };
    case "Medium":
    default:
      return { text: "text-[#f59e0b]", bg: "bg-[#f59e0b]/15", dot: "bg-[#f59e0b]", ring: "#F59E0B" };
  }
}
