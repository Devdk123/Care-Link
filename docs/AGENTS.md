# 🤖 CareLink — Multi-Agent Clinical AI Pipeline

> **Project:** CareLink — Autonomous Multi-Agent HealthTech Platform  
> **Event:** Bharat Agentic 2026 | AIKart 12-Hour Autonomous Agent Hackathon  
> **Track:** Healthcare, MedTech & Clinical AI Agents  
> **Architecture:** 12-Layer Multi-Agent System (LangGraph + Qdrant + Mem0 + Dual-Model Failover)  
> **Author & Lead:** Nishant Maurya ([nishantma05@gmail.com](mailto:nishantma05@gmail.com))  

---

## 📑 Table of Contents

1. [Agent System Overview](#1-agent-system-overview)
2. [Agent Communication & State Model](#2-agent-communication--state-model)
3. [Agent Catalog](#3-agent-catalog)
   - [Supervisor Router Agent](#-supervisor-router-agent)
   - [Triage Agent (MTS + Tool-Use)](#-triage-agent-mts--tool-use)
   - [Risk Analyst Agent (XGBoost + SHAP)](#-risk-analyst-agent-xgboost--shap)
   - [Care Plan Agent (Discharge Planner)](#-care-plan-agent-discharge-planner)
   - [Medication Safety Agent (DDI Blocker)](#-medication-safety-agent-ddi-blocker)
   - [ABHA Identity Lookup Agent](#-abha-identity-lookup-agent)
   - [PM-JAY Eligibility Checker Agent](#-pm-jay-eligibility-checker-agent)
   - [Patient Communication Agent (WhatsApp / SMS)](#-patient-communication-agent-whatsapp--sms)
   - [Vitals Monitor Agent (Continuous Loop)](#-vitals-monitor-agent-continuous-loop)
   - [Appointment Auto-Booking Agent](#-appointment-auto-booking-agent)
   - [PHI Guardrails Agent (HIPAA & Aadhaar)](#-phi-guardrails-agent-hipaa--aadhaar)
   - [Feedback Loop Agent (Active Learning)](#-feedback-loop-agent-active-learning)
4. [Safety, Guardrails & Pharmacovigilance Gates](#4-safety-guardrails--pharmacovigilance-gates)
5. [Grounding & Citation Verification](#5-grounding--citation-verification)
6. [Testing & Verification](#6-testing--verification)

---

## 🧠 1. Agent System Overview

CareLink uses an autonomous multi-agent clinical copilot architecture designed to assist healthcare professionals in post-discharge management, readmission risk prevention, emergency triage, and pharmacovigilance.

```
┌─────────────────────────────────────────────────────────────────┐
│                   CareLink Agent Architecture                   │
│                                                                 │
│  [Clinician Query / Patient EHR Event]                          │
│      │                                                          │
│      ▼                                                          │
│  PHIGuardrailsAgent (HIPAA & Aadhaar Anonymization)             │
│      │                                                          │
│      ▼                                                          │
│  SupervisorRouterAgent (LangGraph StateGraph Intent Router)     │
│      │                                                          │
│      ├───────► TriageAgent (Manchester Triage System Tool-Use)  │
│      ├───────► RiskAnalystAgent (XGBoost + SHAP Narrative)     │
│      ├───────► CarePlanAgent (4-Part Discharge Schedule)        │
│      ├───────► MedicationSafetyAgent (DDI Deterministic Blocker)│
│      ├───────► ABHAAgent (Ayushman Bharat Identity Profile)     │
│      ├───────► PMJAYAgent (Ayushman Bharat ₹5L Coverage Check)  │
│      ├───────► PatientCommunicationAgent (WhatsApp Bilingual)   │
│      ├───────► VitalsMonitorAgent (Telemetry Anomaly Loop)      │
│      └───────► AppointmentAgent (Autonomous Slot Booking)       │
│                                                                 │
│      │                                                          │
│      ▼                                                          │
│  Clinical RAG Engine (Qdrant Cloud) ──► CitationResolverAgent   │
│      │                                                          │
│      ▼                                                          │
│  Mem0 Long-Term Memory Sync ──► FeedbackLoopAgent (Active Learn)│
└─────────────────────────────────────────────────────────────────┘
```

---

## 📡 2. Agent Communication & State Model

Agents communicate through a shared typed state container (`CareLinkAgentState`):

```typescript
export interface CareLinkAgentState {
  patientId: string;
  userQuery: string;
  intent: 'triage' | 'risk_analyst' | 'care_plan' | 'medication_safety' | 'pmjay' | 'abha' | 'general';
  routingConfidence: number;
  routedAgent: string;
  isHindiMode?: boolean;
  
  // Clinical Context
  vitals?: {
    heartRate?: number;
    systolicBp?: number;
    diastolicBp?: number;
    spo2?: number;
    tempCelsius?: number;
    weightChange?: string;
  };
  medications?: string[];
  
  // Agent Outputs
  triageSeverity?: 'EMERGENCY' | 'VERY_URGENT' | 'URGENT' | 'STANDARD' | 'NON_URGENT';
  readmissionRisk?: {
    probability: number;
    riskTier: 'HIGH' | 'MEDIUM' | 'LOW';
    topShapFactors: Array<{ feature: string; impact: number }>;
  };
  carePlan?: {
    medications: string[];
    appointments: string[];
    lifestyle: string[];
    redFlags: string[];
  };
  medicationAlerts?: Array<{
    drugA: string;
    drugB: string;
    severity: 'CRITICAL' | 'MAJOR' | 'MODERATE';
    action: string;
  }>;
  isSafetyBlocked?: boolean;
  
  // Bharat Health Stack
  abhaProfile?: {
    abhaId: string;
    name: string;
    gender: string;
    linkedHospitalRecords: number;
  };
  pmjayStatus?: {
    eligible: boolean;
    coverageAmount: string;
    eligibleProcedures: string[];
  };
  
  // Grounding & Traces
  retrievedGuidelines: Array<{ tag: string; title: string; text: string }>;
  citations: string[];
  groundingFidelity: number;
  executionSteps: Array<{
    step: string;
    agent: string;
    action: string;
    status: 'pending' | 'success' | 'warning' | 'error';
    timestamp: string;
  }>;
}
```

---

## 🩺 3. Agent Catalog

### 🎯 Supervisor Router Agent
- **File:** `src/lib/agents/supervisor.ts`
- **Role:** LangGraph StateGraph orchestrator evaluating intent against a calibrated floor ($\ge 0.60$).
- **Dispatches To:** Triage, Risk Analyst, Care Plan, Medication Safety, ABHA, and PM-JAY specialists.

### 🚑 Triage Agent (MTS + Tool-Use)
- **File:** `src/lib/agents/triageAgent.ts`
- **Role:** Manchester Triage System vital evaluation with Gemini Function Calling (`check_vitals`, `lookup_guideline`, `recommend_escalation`).
- **Triggers:** SpO2 < 92%, Systolic BP > 180 mmHg or < 90 mmHg, Weight increase > 2 kg in 48h.

### 📊 Risk Analyst Agent (XGBoost + SHAP)
- **File:** `src/lib/agents/riskAnalystAgent.ts`
- **Role:** Translates raw ML probabilities (ROC-AUC 0.727) and SHAP feature attributions into 3-sentence clinician narratives grounded in clinical evidence.

### 📋 Care Plan Agent (Discharge Planner)
- **File:** `src/lib/agents/carePlanAgent.ts`
- **Role:** Generates comprehensive 4-part post-discharge schedule: medications, follow-up visits, diet/fluid management, and red-flag warning signs.

### 💊 Medication Safety Agent (DDI Blocker)
- **File:** `src/lib/agents/medicationSafetyAgent.ts`
- **Role:** Hard pharmacovigilance gate checking lethal drug combinations:
  - Warfarin + NSAIDs (fatal gastrointestinal hemorrhage)
  - Metformin + eGFR < 30 mL/min (lactic acidosis)
  - Interruption of Dual Antiplatelet Therapy post-cardiac stent

### 🇮🇳 ABHA Identity Lookup Agent
- **File:** `src/lib/agents/abhaAgent.ts`
- **Role:** Interfaces with the Ayushman Bharat Digital Mission (ABDM) sandbox schema to fetch patient health identifiers, demographics, and prior medical history.

### 🏥 PM-JAY Eligibility Checker Agent
- **File:** `src/lib/agents/pmjayAgent.ts`
- **Role:** Scans socioeconomic and diagnostic criteria to confirm eligibility under Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (₹5,00,000 annual family coverage).

### 💬 Patient Communication Agent (WhatsApp / SMS)
- **File:** `src/lib/agents/patientCommunicationAgent.ts`
- **Role:** Autonomously formats post-discharge instructions into a bilingual WhatsApp/SMS notification (Hindi + English) with emergency contact triggers.

### 📈 Vitals Monitor Agent (Continuous Loop)
- **File:** `src/lib/agents/vitalsMonitorAgent.ts`
- **Role:** Background polling loop tracking patient telemetry; automatically escalates to TriageAgent when deterioration is detected.

### 📅 Appointment Auto-Booking Agent
- **File:** `src/lib/agents/appointmentAgent.ts`
- **Role:** Automatically reserves the earliest cardiology/specialist review slot in the CareLink calendar for high-risk patients.

### 🛡️ PHI Guardrails Agent (HIPAA & Aadhaar)
- **File:** `src/lib/guardrails.ts`
- **Role:** Regex + NER tokenizer scrubbing patient names, MRNs, phone numbers, and 12-digit Indian Aadhaar numbers before any external inference.

### 🔄 Feedback Loop Agent (Active Learning)
- **File:** `src/lib/feedbackAgent.ts`
- **Role:** Records doctor approvals vs. overrides, calculates moving override rate $\rho$, triggers drift warnings if $\rho > 15\%$, and exports fine-tuning retraining datasets.

---

## 🔒 4. Safety, Guardrails & Pharmacovigilance Gates

1. **Zero External PHI:** All outbound requests are scrubbed with reversible synthetic tokens.
2. **Deterministic Blocker:** If a `CRITICAL` drug interaction is detected, care plan generation is locked immediately with a physician alert.
3. **Failover Guarantee:** In the event of Gemini HTTP 429 quota exhaustion, Groq Cloud inference executes in $<500\text{ ms}$.

---

## 🏷️ 5. Grounding & Citation Verification

Every clinical claim must cite evidence tags (`[ICMR-HF-01]`, `[AHA-DDI-01]`, `[KDIGO-CKD-01]`). The `citationResolver.ts` engine verifies token overlap with retrieved guidelines and computes a Grounding Fidelity score ($0.0 - 1.0$).

---

*CareLink Multi-Agent Pipeline Documentation — Bharat Agentic 2026.*
