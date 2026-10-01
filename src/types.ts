// ========================================
// Tab Navigation
// ========================================
export type TabType =
  | "landing"
  | "home"
  | "patients"
  | "calendar"
  | "analytics"
  | "cockpit"
  | "settings"
  | "login"
  | "reset-password"
  | "404";

// ========================================
// Backend-Aligned Types (ML Readmission Risk System)
// ========================================
export type RiskTier = "Low" | "Medium" | "High";

/**
 * Patient from backend's v_patient_latest_risk view.
 * This is the SINGLE source of truth for patient data.
 * Matches: GET /patients response from FastAPI api.py
 */
export interface Patient {
  patient_id: number;
  external_ref: string;
  age: number | null;
  gender: string | null;
  admission_type: string | null;
  discharge_location: string | null;
  probability: number | null;
  risk_tier: RiskTier | null;
  predicted_label: number | null;
  predicted_at: string | null;
}

/**
 * SHAP feature contribution from model explanation.
 * Matches: top_factors[] in GET /predict/{id} response.
 */
export interface ShapFactor {
  feature: string;
  impact: number;
}

/**
 * Full prediction result from the ML model.
 * Matches: GET /predict/{patient_id} response from FastAPI api.py
 */
export interface Prediction {
  prediction_id: number;
  patient_id: number;
  external_ref: string;
  probability: number;
  risk_tier: RiskTier;
  prediction: 0 | 1;
  top_factors: ShapFactor[];
}

/**
 * Clinician feedback payload (confirm / override).
 * Matches: POST /feedback body schema from FastAPI api.py
 */
export interface FeedbackPayload {
  prediction_id: number;
  action: "confirmed" | "overridden";
  corrected_label?: number;
  note?: string;
  clinician_ref?: string;
}

/**
 * Privacy report from the DP accountant.
 * Matches: GET /privacy-report response from FastAPI api.py
 */
export interface PrivacyReport {
  epsilon_spent: number;
  delta: number;
  noise_multiplier: number;
  rounds_completed: number;
  privacy_guarantee: string;
}

// ========================================
// AI Triage (Gemini-powered)
// ========================================
export interface TriageResult {
  urgencyLevel: "IMMEDIATE" | "URGENT" | "SEMI-URGENT" | "NON-URGENT";
  clinicalSummary: string;
  primaryConcerns: string[];
  recommendedActions: string[];
  estimatedWaitTime: string;
  redFlags: string[];
  confidence: number;
}

// ========================================
// Frontend-Only Types (Clinic Management)
// These features exist only in the frontend and are
// not part of the ML backend.
// ========================================
export type AppointmentStatus =
  | "Upcoming"
  | "In Progress"
  | "Waiting"
  | "Completed"
  | "Canceled";

export interface Appointment {
  id: string;
  time: string;
  date: string;
  patientName: string;
  patientInitials: string;
  patientAvatar?: string;
  department: string;
  doctor: string;
  type: string;
  status: AppointmentStatus;
  urgency?: "High" | "Medium" | "Low";
  notes?: string;
}

export interface ActivityItem {
  id: string;
  type: "lab" | "referral" | "prescription" | "appointment";
  patientName: string;
  description: string;
  timestamp: string;
  statusColor?: string;
}

export interface DoctorProfile {
  name: string;
  title: string;
  department: string;
  avatarUrl: string;
  email: string;
  status?: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: "success" | "info" | "error";
}
