# 🏗️ CareLink Technical Architecture Document

> **Project:** CareLink — Autonomous Multi-Agent HealthTech Platform  
> **Event:** Bharat Agentic 2026 | AIKart 12-Hour Hackathon  
> **Version:** 3.0.0-Agentic  
> **Last Updated:** 2026-09-29  
> **Architect:** Nishant Maurya ([nishantma05@gmail.com](mailto:nishantma05@gmail.com))  
> **Status:** ✅ Approved Specification  

---

## 📑 Table of Contents

1. [System Overview & Core Principles](#1-system-overview--core-principles)
2. [12-Layer Autonomous Agent Hierarchy](#2-12-layer-autonomous-agent-hierarchy)
3. [Dual-Model Failover Protocol](#3-dual-model-failover-protocol)
4. [Zero-PHI Security & Tokenization Pipeline](#4-zero-phi-security--tokenization-pipeline)
5. [Clinical RAG & Vector Storage (Qdrant)](#5-clinical-rag--vector-storage-qdrant)
6. [Long-Term Memory Architecture (Mem0)](#6-long-term-memory-architecture-mem0)
7. [Active Learning & Continuous Retraining Loop](#7-active-learning--continuous-retraining-loop)
8. [Observability & RAGAS Telemetry](#8-observability--ragas-telemetry)

---

## 1. System Overview & Core Principles

CareLink is architected under five non-negotiable principles for clinical artificial intelligence:

1. **Deterministic Safety Over Generative Probability:** Pharmacovigilance checks and lethal drug-drug interactions (DDI) are evaluated by hard-coded algorithmic filters *before* LLMs can emit text.
2. **Zero Ingress/Egress PHI:** Patient identity (names, MRNs, phone numbers, Aadhaar numbers) is scrubbed into reversible tokens inside the local firewall before external inference.
3. **Resilience & High Availability:** A dual-model failover engine guarantees $<500\text{ ms}$ provider switching from Gemini to Groq upon HTTP 429 quota exhaustion.
4. **Evidence-Grounded Verifiability:** Every clinical claim must cite a verified guideline (`[ICMR-HF-01]`, `[AHA-DDI-01]`) with Grounding Fidelity score $\ge 0.70$.
5. **Human-in-the-Loop Active Learning:** Clinicians retain final authority to approve or override recommendations, feeding an active learning loop with drift detection ($\rho > 15\%$).

---

## 2. 12-Layer Autonomous Agent Hierarchy

```
Layer 11: Frontend Agent Cockpit UI (React 19 + Recharts + Light Mode)
Layer 10: Observability & Tracing (LangSmith Spans + RAGAS Benchmark)
Layer 9:  Federated ML Engine (Flower Framework + XGBoost ROC-AUC 0.727)
Layer 8:  Active Learning Feedback Monitor (Clinician Overrides + Drift Detection)
Layer 7:  Long-Term Patient Memory (Mem0 Cloud + Local Mirror)
Layer 6:  Clinical RAG & Citation Resolver (Qdrant Cloud + 10 Guidelines)
Layer 5:  Autonomous Action Agents (WhatsApp Dispatch, Vitals Alert, Booking)
Layer 4:  Bharat Health Stack Agents (ABHA ID Lookup, PM-JAY ₹5L Eligibility)
Layer 3:  Clinical Specialist Agents (Triage MTS, Risk XGB, CarePlan, MedSafety)
Layer 2:  LangGraph Supervisor Intent Router (StateGraph >= 0.60 floor)
Layer 1:  HIPAA & Aadhaar Zero-Leak PHI Guardrails (Regex + NER)
Layer 0:  Resilient Multi-LLM Gateway (Gemini 2.5 Flash ⚡ Groq Cloud)
```

---

## 3. Dual-Model Failover Protocol

```
Clinician Request
       │
       ▼
[Gemini 2.5 Flash] ───(Success)───► Complete Pipeline (<600ms)
       │
   (HTTP 429 RateLimit / 503 / 8s Timeout)
       │
       ▼ (<500ms auto-switch)
[Groq Cloud: Llama-3.3-70b / gpt-oss-120b] ───(Success)───► Complete Pipeline
       │
   (Network / Secondary Outage)
       │
       ▼
[Deterministic Safe Clinical Fallback] ───► Standard Guidance + Audit Log
```

---

## 4. Zero-PHI Security & Tokenization Pipeline

The PHI Scrubber (`src/lib/guardrails.ts`) intercepts queries before network transmission:
- Names: `Patient:\s[A-Z][a-z]+` $\rightarrow$ `[PATIENT_001]`
- MRNs: `MRN[:\s]\d+` $\rightarrow$ `[MRN_REDACTED]`
- Aadhaar: `\b\d{4}\s?\d{4}\s?\d{4}\b` $\rightarrow$ `[AADHAAR_XXXX]`
- Phone: `(?:\+91[\-\s]?)?[6789]\d{9}` $\rightarrow$ `[PHONE_REDACTED]`

De-tokenization occurs in-memory only when the authorized clinician views the rendered result on the bedside UI.

---

## 5. Clinical RAG & Vector Storage (Qdrant)

The Clinical RAG engine indexes 10 peer-reviewed protocols into Qdrant Cloud collection `carelink_guidelines` with in-memory cosine fallback:
1. `[ICMR-HF-01]`: Heart Failure Post-Discharge & GDMT Titration
2. `[AHA-DDI-01]`: Anticoagulation & NSAID Gastrointestinal Hemorrhage
3. `[KDIGO-CKD-01]`: CKD Guideline (Metformin with eGFR < 30, ACE-i/ARB)
4. `[WHO-SEPSIS-01]`: International Guidelines for Sepsis Management
5. `[AHA-HTN-01]`: High Blood Pressure Clinical Practice Guideline
6. `[GOLD-COPD-01]`: Chronic Obstructive Lung Disease SpO2 Protocol
7. `[ICMR-DM-01]`: Type 2 Diabetes Management in Acute Illness
8. `[NICE-CG-01]`: Acutely Ill Adults & NEWS2 Urgency Protocol
9. `[IAP-PEDS-01]`: Indian Academy of Pediatrics Severe Illness Protocol
10. `[STENT-CAD-01]`: ACC/AHA Coronary Revascularization DAPT Protocol

---

## 6. Long-Term Memory Architecture (Mem0)

Mem0 Cloud REST API is configured with session scoping (`user_id = patient_id`):
- Non-authoritative context notes injected into supervisor prompts.
- Recalls past adverse drug events (e.g. "Patient developed rash on penicillin in 2024").
- Recalls clinician override habits (e.g. "Dr. Sharma prefers earlier follow-up for CKD Stage 3").

---

## 7. Active Learning & Continuous Retraining Loop

- Logs every clinician approval or override to the database audit trail.
- Moving override rate $\rho = \frac{\text{Overrides}}{\text{Total Reviews}}$.
- When $\rho > 15\%$, triggers an active model drift alert.
- Generates fine-tuning datasets for federated retraining across hospital nodes.

---

## 8. Observability & RAGAS Telemetry

- Run traces recorded in `.runtime/traces/` with span IDs, latency breakdown, and token usage.
- Standardized RAGAS evaluation runner benchmarked on 5 clinical cases:
  - Faithfulness: **0.834 – 1.000**
  - Context Precision: **0.667 – 1.000**
  - Hallucination Penalty: Drops to **0.267** on synthetic ungrounded inputs.

---

*CareLink Technical Architecture Document — Bharat Agentic 2026.*
