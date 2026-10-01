# 🔌 CareLink API Documentation

> **Project:** CareLink — Autonomous Multi-Agent HealthTech Platform  
> **Event:** Bharat Agentic 2026 | AIKart 12-Hour Hackathon  
> **API Version:** v3.0-Agentic  
> **Base URL:** `http://localhost:3005`  
> **Format:** REST + JSON  
> **Last Updated:** 2026-09-29  
> **Maintainer:** Nishant Maurya ([nishantma05@gmail.com](mailto:nishantma05@gmail.com))  

---

## 📌 1. Overview

CareLink's Express backend (`server.ts`) exposes high-performance REST endpoints for clinical triage, multi-agent pipeline orchestration, Mem0 long-term memory sync, active learning feedback, and RAGAS evaluation.

### Core Security Principles
- **Zero Client-Side Keys:** All Gemini and Groq API keys remain strictly on the server.
- **HIPAA Guardrails:** Requests passing through `/api/agent/execute` have PHI tokenized automatically.
- **Failover Protection:** Automatic transition to Groq upon Gemini quota limits.

---

## 🤖 2. Agent Execution Endpoints

### `POST /api/agent/execute`
Main entry point for the 12-layer multi-agent pipeline (Supervisor $\rightarrow$ Specialist $\rightarrow$ RAG $\rightarrow$ Citations $\rightarrow$ Safety).

**Request Body:**
```json
{
  "query": "Patient with Stage 3 Heart Failure developed dry cough and ankle edema. History of hypertension.",
  "patientId": "patient_sunita_91",
  "vitals": {
    "spo2": 91,
    "systolic": 145,
    "diastolic": 92,
    "weightChange": "+2.5 kg"
  },
  "medications": "Warfarin 5mg, Enalapril 10mg, Furosemide 40mg",
  "isHindi": false
}
```

**Response (200 OK):**
```json
{
  "routedAgent": "Triage Specialist",
  "agentResponse": "Manchester Triage Grade: VERY URGENT. Patient exhibits acute decompensated heart failure with significant fluid overload (+2.5 kg weight gain) and hypoxia (SpO2 91%). Titrate loop diuretic and perform urgent clinical evaluation per [ICMR-HF-01].",
  "citations": ["[ICMR-HF-01]"],
  "groundingFidelity": 1.0,
  "medicationAlerts": [],
  "isBlockedBySafety": false,
  "executionSteps": [
    { "step": "Supervisor Intent Routing", "status": "success", "agent": "Supervisor" },
    { "step": "MTS Physiological Evaluation", "status": "success", "agent": "TriageAgent" },
    { "step": "Qdrant Guideline Search", "status": "success", "agent": "ClinicalRAG" },
    { "step": "Model Gateway Inference", "status": "success", "agent": "Gemini-2.5-Flash" },
    { "step": "Citation Verification", "status": "success", "agent": "CitationResolver" }
  ],
  "modelMetrics": {
    "provider": "gemini",
    "model": "gemini-2.5-flash",
    "latencyMs": 412,
    "costUsd": 0.00012
  }
}
```

---

### `POST /api/agent/run`
Server-side LLM proxy executing prompts with auto-failover, preventing client-side API key leakage.

**Request Body:**
```json
{
  "systemPrompt": "You are a clinical decision support system...",
  "userMessage": "Summarize patient risk factors...",
  "maxTokens": 500,
  "fallbackText": "Clinical service unavailable"
}
```

---

## 💾 3. Memory & Active Learning Endpoints

### `POST /api/agent/memory/add`
Stores a clinical observation or allergy record into Mem0 long-term memory.

**Request Body:**
```json
{
  "patientId": "patient_sunita_91",
  "text": "Severe anaphylactic allergy to Penicillin G noted during 2024 admission."
}
```

### `POST /api/agent/memory/recall`
Recalls historical context and clinical notes for a specific patient.

**Request Body:**
```json
{
  "patientId": "patient_sunita_91",
  "query": "penicillin allergy"
}
```

---

### `POST /api/agent/feedback/record`
Records clinician approvals or overrides for active learning.

**Request Body:**
```json
{
  "patientId": "patient_sunita_91",
  "clinicianAction": "Overridden",
  "suggestedAction": "Standard Discharge Schedule",
  "overrideReason": "Dr. Sharma recommended immediate cardiology consult due to rising troponin."
}
```

### `GET /api/agent/feedback/metrics`
Returns real-time active learning drift metrics.

**Response:**
```json
{
  "totalReviews": 45,
  "approvals": 41,
  "overrides": 4,
  "overrideRate": 0.088,
  "isDriftDetected": false,
  "driftThreshold": 0.15
}
```

---

## 📈 4. Observability & Telemetry

### `GET /api/agent/observability/summary`
Returns recent LangSmith run traces, token costs, and average provider latency.

### `POST /api/agent/eval/ragas`
Triggers the standardized RAGAS clinical evaluation suite across 5 benchmark cases.

---

*CareLink API Documentation — Bharat Agentic 2026.*
