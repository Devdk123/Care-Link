# 📋 CareLink x Bharat Agentic 2026 — Master Product Requirements Document (PRD)

> **Project Name:** CareLink Agentic AI — Autonomous Multi-Agent HealthTech Platform  
> **Fusion Target:** CareLink Core + AuRAG Agentic Architecture  
> **Event:** Bharat Agentic 2026 | AIKart 12-Hour Autonomous Agent Hackathon (1 Oct 2026)  
> **Track:** Healthcare, MedTech & Clinical AI Agents  
> **Author & Lead:** Nishant Maurya ([nishantma05@gmail.com](mailto:nishantma05@gmail.com))  
> **Status:** 🟢 Approved Master Specification & Phased Execution Blueprint  
> **Version:** 3.0.0-Bharat-Agentic (Post-Deep-Audit Revision)  
> **Pre-Hackathon Score Baseline:** 68/100 ➔ **Target Hackathon Score:** 95+/100 (Top-4 / Winner Contender)

---

## 🧭 Executive Summary

CareLink is a production-grade clinical copilot built for India's healthcare ecosystem. It tackles the severe crisis of **30-day patient readmissions** after acute cardiac, metabolic, and respiratory events. In high-volume Indian hospitals and primary health centers, clinicians face extreme burnout and cannot review thousands of post-discharge physiological variables manually. Furthermore, conventional LLMs hallucinate medical advice without clinical grounding, leak Protected Health Information (PHI) across API boundaries, and fail under rate limits.

Following a pre-hackathon deep audit (`CareLink_Deep_Audit_Report.pdf`), CareLink is upgraded from a 9-layer system into a **12-Layer Autonomous HealthTech Architecture** fusing the best agentic components from **AuRAG** (LangGraph StateGraph supervisor, resilient Gemini $\rightarrow$ Groq auto-failover, Qdrant Cloud clinical RAG, and Mem0 long-term memory) with **Bharat-native health integrations**:
1. **Zero Raw PHI Leakage:** 100% of HIPAA PII/PHI (names, MRNs, phone numbers, Aadhaar numbers) is scrubbed into reversible tokens inside the local firewall before external inference.
2. **Deterministic Pharmacovigilance:** Hard rule engines block fatal drug interactions (e.g., Warfarin + NSAID, Metformin with eGFR < 30 mL/min) before LLM generation.
3. **Evidence-Grounded RAG:** Clinical decisions cite verified guidelines (`[ICMR-HF-01]`, `[AHA-DDI-01]`, `[KDIGO-CKD-01]`, `[WHO-SEPSIS-01]`) with Grounding Fidelity $\ge 0.70$.
4. **Bharat Health Stack Integration:** Native support for Ayushman Bharat Digital Mission (ABHA ID), PM-JAY eligibility verification (₹5 Lakhs benefit), and bilingual Hindi output for ASHA workers.
5. **Autonomous Action & Monitoring:** Autonomous WhatsApp patient follow-ups, continuous background vitals monitoring loops with simulated deterioration alerts, and automated appointment booking.

```
       ┌────────────────────────────────────────────────────────┐
       │     CareLink Agent Cockpit UI (React 19 + Vite)        │
       │    Bilingual (English / Hindi ASHA Mode) • Streaming   │
       └──────────────────────────┬─────────────────────────────┘
                                  │
       ┌──────────────────────────▼─────────────────────────────┐
       │     Layer 2: LangGraph Supervisor Orchestrator         │
       │  Intent Routing (>= 0.60 floor) • Tool Call Dispatcher │
       └─────┬──────────────┬──────────────┬──────────────┬─────┘
             │              │              │              │
    ┌────────▼──────┐┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐
    │ Triage Agent  ││ Care Plan   ││Risk Analyst ││Med Safety   │
    │ MTS Tool-Use  ││ 4-Part Plan ││XGB+SHAP+RAG ││DDI Blocker  │
    └────────┬──────┘└──────┬──────┘└──────┬──────┘└──────┬──────┘
             │              │              │              │
    ┌────────▼──────┐┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐
    │ ABHA Lookup   ││ PM-JAY Agent││ WhatsApp Com││Vitals Monitor│
    │ ABDM Profile  ││ ₹5L Benefit ││ Patient Msg ││ Alert Loop  │
    └────────┬──────┘└──────┬──────┘└──────┬──────┘└──────┬──────┘
             │              │              │              │
       ┌─────▼──────────────▼──────────────▼──────────────▼─────┐
       │ Layer 1: Zero-Leak HIPAA & Aadhaar PHI Guardrails     │
       └──────────────────────────┬─────────────────────────────┘
                                  │
       ┌──────────────────────────▼─────────────────────────────┐
       │ Layer 0: Resilient Model Gateway (Gemini ⚡ Groq <500ms)│
       └──────────────────────────┬─────────────────────────────┘
                                  │
       ┌──────────────────────────▼─────────────────────────────┐
       │ Layer 5: Clinical RAG (Qdrant) + Mem0 Long-Term Memory │
       └────────────────────────────────────────────────────────┘
```

---

## 1. Problem Statement & Hackathon Scoring Matrix

### 1.1 The Bharat Healthcare Reality
- **Bedside Cognitive Overload:** In government and private hospitals across Bharat, doctor-to-patient ratios exceed 1:1,000. Post-discharge check-ins are rare.
- **Language Barrier:** Over 600 million citizens speak Hindi and regional languages; traditional hospital discharge summaries in English leave patients and rural ASHA workers confused.
- **Unregulated Generative AI Risks:** Generative LLMs hallucinate dosages, fail when rate limits strike, and expose sensitive patient health records.

### 1.2 Bharat Agentic 2026 Scoring Breakdown & Trajectory
| Evaluation Dimension | Weight | Baseline (Audit) | With Upgrades | Key Hackathon Win Factor |
| :--- | :---: | :---: | :---: | :--- |
| **Agentic Depth & Tool Use** | 30% | 5.0 / 10 | **9.8 / 10** | LangGraph StateGraph, Gemini Function Calling (`check_vitals`, `lookup_guideline`), autonomous action loops |
| **Bharat Health Stack** | 20% | 2.0 / 10 | **9.5 / 10** | ABHA ID lookup agent, PM-JAY ₹5L eligibility checker, Hindi output for ASHA workers |
| **Clinical RAG & Grounding** | 20% | 8.0 / 10 | **9.8 / 10** | 10 ICMR/AHA/WHO guidelines in Qdrant Cloud, token-overlap Citation Resolver |
| **Privacy, Safety & Failover** | 15% | 8.0 / 10 | **9.9 / 10** | HIPAA Regex+NER scrubber, server-side key isolation, Gemini ⚡ Groq failover |
| **Observability & Feedback** | 15% | 5.5 / 10 | **9.5 / 10** | Active learning drift alerts (>15%), LangSmith spans, RAGAS faithfulness (>0.85) |
| **TOTAL SCORE** | 100% | **68 / 100** | **96 / 100** | **PODIUM / TOP-4 WINNER CONTENDER** |

---

## 2. Complete 12-Layer Architecture Specification

### Layer 0: Resilient Multi-LLM Gateway (Failover Engine)
- **Primary:** Google Gemini 2.5 Flash (`gemini-2.5-flash`).
- **Failover:** Groq Cloud (`llama-3.3-70b-versatile` / `openai/gpt-oss-120b`).
- **Switch Latency:** $< 500\text{ ms}$ on HTTP 429 quota exhaustion or HTTP 503 spike.
- **Security Rule:** All model calls execute strictly on the server (`server.ts`). **Zero API keys exposed to browser.**

### Layer 1: HIPAA & Aadhaar PHI Guardrails Agent
- **Inbound Filter:** Regex + NER tokenization replacing patient names (`[PATIENT_001]`), MRNs (`[MRN_REDACTED]`), phone numbers, and Indian 12-digit Aadhaar numbers (`[AADHAAR_XXXX]`).
- **Safety Gate:** Deterministic regex filter blocking self-harm prompts and fatal drug interaction regimens prior to inference.
- **Outbound De-tokenization:** In-memory de-tokenization within the hospital firewall before UI presentation.

### Layer 2: LangGraph Supervisor Orchestrator Agent
- **Router Pattern:** LangGraph `StateGraph` with calibrated confidence floor ($\ge 0.60$).
- **Dispatches To:** 8 specialist agents based on intent analysis.
- **Fallback:** Deterministic MTS Triage fallback on low confidence or ambiguous clinical context.

### Layer 3: Clinical Specialist Agent Cluster
1. **Triage Agent (MTS + Tool-Use):** Manchester Triage System with Gemini function calling (`check_vitals`, `lookup_guideline`, `recommend_escalation`).
2. **Risk Analyst Agent (Interpretable ML):** Interprets XGBoost readmission probability (ROC-AUC 0.727) and converts SHAP waterfall into 3-sentence clinical narratives.
3. **Care Plan Agent (Discharge Planner):** Generates structured 4-part post-discharge plan: medications, appointments, diet/lifestyle, and red-flag warning signs.
4. **Medication Safety Agent (DDI Blocker):** Deterministic pharmacovigilance gate checking drug combinations (Warfarin + NSAID, Metformin + eGFR < 30) with `CRITICAL` blockers.

### Layer 4: Bharat Health Stack & Accessibility Agents
5. **ABHA Identity Lookup Agent:** Connects to Ayushman Bharat Digital Mission (ABDM) sandbox schema to fetch patient health profile and linked diagnoses.
6. **PM-JAY Eligibility Checker Agent:** Evaluates patient eligibility for Pradhan Mantri Jan Arogya Yojana (₹5,00,000 coverage, empanelled procedures).
7. **Linguistic Translation Agent (ASHA Worker Mode):** Converts technical clinical plans into simple Devanagari Hindi for village-level health workers.

### Layer 5: Autonomous Action & Communication Agents
8. **Patient Communication Agent:** Autonomously drafts WhatsApp/SMS discharge and medication adherence messages in Hindi + English with one-click dispatch.
9. **Vitals Monitor Agent:** Background polling loop inspecting live telemetry; triggers automated triage alerts upon simulated SpO2/BP deterioration.
10. **Appointment Auto-Booking Agent:** Automatically reserves the earliest cardiology/specialist review slot in the EHR calendar for high-risk patients.

### Layer 6: Clinical RAG & Knowledge Engine
- **Vector DB:** Qdrant Cloud (`carelink_guidelines` collection) with in-memory semantic search fallback.
- **Corpus:** 10 curated clinical guidelines from ICMR, WHO, NICE, AHA, KDIGO, IAP, and GOLD.
- **Citation Resolver:** Enforces bracketed citations (`[ICMR-HF-01]`) with Grounding Fidelity score ($0.0 - 1.0$).

### Layer 7: Long-Term Memory Engine (Mem0)
- **Technology:** Mem0 Cloud REST API with local `.runtime/mem0/memories.json` fallback.
- **Capabilities:** Recalls chronic allergies, past adverse drug reactions, and doctor override tendencies across visits.

### Layer 8: Active Learning & Drift Monitor
- **Clinician-in-the-Loop:** Captures doctor approvals vs. overrides.
- **Drift Alert:** Automatically triggers warning when moving override rate $\rho > 15\%$, compiling fine-tuning datasets for federated retraining.

### Layer 9: Federated Machine Learning Engine
- **Framework:** Flower Framework across 3 simulated hospital nodes (Apollo, Fortis, Max).
- **Model:** XGBoost classifier with differential privacy accountant ($\epsilon = 1.2, \delta = 10^{-5}$).

### Layer 10: Observability & Evaluation Layer
- **Telemetry:** LangSmith-compatible run trace instrumentation (`.runtime/traces/`).
- **RAGAS Benchmark:** Faithfulness ($>0.80$), Context Precision ($>0.60$), and Answer Relevancy scoring.

### Layer 11: Frontend Agent Cockpit UI (React 19)
- **Features:** Live StateGraph visualizer, step-by-step animated execution feed, bilingual toggle (English / Hindi), and clinician review controls.

---

## 3. AuRAG Extraction & Pruning Blueprint

### 3.1 Components Extracted from `aurag/`:
| AuRAG Module | CareLink Destination | Adaptation Status |
| :--- | :--- | :--- |
| `aurag/agents/gateway.py` | `src/lib/failoverLlm.ts` & `backend/agents/gateway.py` | ✅ Extracted — Gemini ⚡ Groq auto-failover |
| `aurag/agents/guardrails.py` | `src/lib/guardrails.ts` & `backend/agents/guardrails.py` | ✅ Extracted — HIPAA Regex+NER + Aadhaar masking |
| `aurag/agents/citation_resolver.py` | `src/lib/citationResolver.ts` & `backend/agents/citation_resolver.py` | ✅ Extracted — Grounding fidelity & evidence badges |
| `aurag/agents/supervisor.py` | `src/lib/agents/supervisor.ts` & `backend/agents/supervisor.py` | ✅ Extracted — LangGraph StateGraph router |
| `aurag/backend/app/core/memory.py`| `src/lib/memory.ts` & `backend/agents/memory.py` | ✅ Extracted — Mem0 cross-session memory |
| `aurag/evaluation/score.py` | `src/lib/agents/evalRagas.ts` & `backend/agents/eval_ragas.py` | ✅ Extracted — RAGAS benchmark runner |

### 3.2 Unwanted Components to Prune from `aurag/`:
*(Note: As instructed, pruning will be performed in Phase 10 upon explicit user confirmation)*
- ❌ `aurag/ingestion/parsers/vision_pnid.py` (Industrial P&ID CAD parser)
- ❌ `aurag/backend/app/api/machine_money.py` & `aurag/backend/app/services/machine_money/` (Bitcoin LNbits / Lightning)
- ❌ `aurag/infra/neo4j/` (Industrial plant Cypher scripts)
- ❌ `aurag/tests/test_machine_money*.py` (Machine money test suites)
- ❌ `aurag/telemetry/generator.py` (Industrial pump SCADA simulation)

---

## 4. Master Task-by-Task Execution Plan

The roadmap is structured into 10 testable phases. Phases 1–6 are verified and completed. Phases 7–10 are executed on user command:

### ✅ COMPLETED PHASES (Baseline Foundation)
- [x] **Phase 1: Dual-Model Failover Gateway** (`gemini-2.5-flash` ⚡ `groq` `<500ms`, cost/token metrics).
- [x] **Phase 2: PHI Guardrails & Qdrant Clinical RAG** (HIPAA scrubber, 10 guidelines, citation resolver).
- [x] **Phase 3: LangGraph Supervisor & 4 Specialists** (StateGraph router, Triage, Risk, CarePlan, MedSafety).
- [x] **Phase 4: Long-Term Memory & Active Learning** (Mem0 integration, $>15\%$ drift detection).
- [x] **Phase 5: Frontend Agent Cockpit UI** (React 19, StateGraph visualizer, reasoning trace, review actions).
- [x] **Phase 6: Observability & RAGAS Evaluator** (LangSmith traces, RAGAS benchmark test suites, hackathon docs).

---

### 🚀 UPCOMING PHASES (Winning Upgrades from Deep Audit)

### Phase 7: Critical Security & Configuration Hardening
- [x] **Task 7.1:** Move all direct LLM calls to `server.ts` via `/api/agent/run` and `/api/agent/llm-call`, and sanitize `failoverLlm.ts` to eliminate client-side key leakage.
- [x] **Task 7.2:** Update `.env.example` with all production keys (`GROQ_API_KEY`, `MEM0_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `LANGSMITH_API_KEY`).
- [x] **Task 7.3:** Clean all placeholder tokens (`[Project Name]`, `[Developer Name]`, `[YYYY-MM-DD]`, `XX`) from documentation files (`Architecture.md`, `TECHNICAL_ARCHITECTURE.md`, `FEATURE_TICKET_LIST.md`, `DEMO_SCRIPT.md`, `PRD_CLOSURE.md`).
- [x] **Task 7.4:** Git commit Phase 7 changes locally (no push).

### Phase 8: Bharat Health Stack & Linguistic Accessibility
- [x] **Task 8.1:** Build `pmjayAgent.ts` — Ayushman Bharat PM-JAY eligibility verification agent (₹5,00,000 benefit & covered procedures).
- [x] **Task 8.2:** Build `abhaAgent.ts` — Ayushman Bharat Digital Mission (ABDM) mock ID lookup agent with health record linking.
- [x] **Task 8.3:** Add Hindi Language Output Mode (Devanagari script) in Agent Cockpit with specialized prompts for ASHA workers.
- [x] **Task 8.4:** Mount Bharat agents in `server.ts` and test with Indian patient profiles.
- [x] **Task 8.5:** Git commit Phase 8 changes locally (no push).

### Phase 9: Real Function Calling & Autonomous Action Agents
- [ ] **Task 9.1:** Upgrade `triageAgent.ts` to real Gemini Function Calling / Tool Use (`check_vitals`, `lookup_guideline`, `recommend_escalation`).
- [ ] **Task 9.2:** Build `patientCommunicationAgent.ts` — Autonomous bilingual WhatsApp/SMS discharge & reminder draft generator with one-click send.
- [ ] **Task 9.3:** Build `vitalsMonitorAgent.ts` — Autonomous background monitoring loop detecting simulated vitals deterioration (SpO2 drop to 88%) with instant alerts.
- [ ] **Task 9.4:** Build `appointmentAgent.ts` — Autonomous follow-up appointment booking in the CareLink calendar for high-risk patients.
- [ ] **Task 9.5:** Git commit Phase 9 changes locally (no push).

### Phase 10: Streaming Cockpit UX, AuRAG Pruning & Hackathon Polish
- [ ] **Task 10.1:** Implement animated step-by-step agent execution visualization and typewriter response streaming in `AgentCockpitView.tsx`.
- [ ] **Task 10.2:** Display PM-JAY card, ABHA ID badge, and WhatsApp follow-up preview inside the Cockpit.
- [ ] **Task 10.3:** Prune unwanted industrial modules from `aurag/` while keeping core agent references safe.
- [ ] **Task 10.4:** Rehearse the 3-minute winning demo flow (CHF $\rightarrow$ Vitals Alert $\rightarrow$ Hindi Plan $\rightarrow$ WhatsApp Send).
- [ ] **Task 10.5:** Final git commit locally (no push).

---

*CareLink PRD v3.0 Approved for Bharat Agentic 2026 by Nishant Maurya.*
