# ✅ CareLink Agentic AI — Master Task Tracker

> **Event:** Bharat Agentic 2026 | AIKart 12-Hour Hackathon (1 Oct 2026)  
> **Project:** CareLink Autonomous Multi-Agent HealthTech Platform  
> **Lead:** Nishant Maurya ([nishantma05@gmail.com](mailto:nishantma05@gmail.com))  
> **PRD Reference:** [`docs/Prd.md`](file:///c:/Users/nisha/OneDrive/Documents/Downloads/carelink/docs/Prd.md)  
> **Pre-Hackathon Score Baseline:** 68/100 ➔ **Target Score:** 96/100 (Top-4 / Winner Contender)  
> **Status:** 🟢 ALL 10 PHASES COMPLETE (100% Verified & Tested)  

---

## 📊 Progress Overview

```
Phase 1 — Dual-Model Failover Engine      ██████████ 100% ✅ (Completed)
Phase 2 — PHI Guardrails & Knowledge RAG  ██████████ 100% ✅ (Completed)
Phase 3 — Supervisor & 4 Specialists      ██████████ 100% ✅ (Completed)
Phase 4 — Long-Term Memory & Feedback     ██████████ 100% ✅ (Completed)
Phase 5 — Frontend Agent Cockpit UI       ██████████ 100% ✅ (Completed)
Phase 6 — Observability & E2E Testing     ██████████ 100% ✅ (Completed)
Phase 7 — Security & Config Hardening     ██████████ 100% ✅ (Completed)
Phase 8 — Bharat Health Stack Agents      ██████████ 100% ✅ (Completed)
Phase 9 — Function Calling & Autonomy     ██████████ 100% ✅ (Completed)
Phase 10 — Streaming UX & AuRAG Pruning   ██████████ 100% ✅ (Completed)
Phase 11 — LiveKit Docs MCP & Telephony   ██████████ 100% ✅ (Completed)
Phase 12 — Sarvam AI Indic Multi-Language ██████████ 100% ✅ (Completed)
Phase 13 — Critical Escalation & Policy   ██████████ 100% ✅ (Completed)
Phase 14 — Voice Agent & Signed Webhooks  ██████████ 100% ✅ (Completed)
Phase 15 — Escalation Cockpit & Timeline  ██████████ 100% ✅ (Completed)
```

---

## ✅ COMPLETED PHASES (Phases 1–6)

### 🚀 Phase 1: Dual-Model Failover Engine
- [x] **Task 1.1:** Build `failoverLlm.ts` & `gateway.py` (Gemini 2.5 Flash ⚡ Groq Llama-3.3-70b auto-failover in <500ms).
- [x] **Task 1.2:** Implement token usage calculation, estimated USD cost, and latency tracking.
- [x] **Task 1.3:** Test failover live with simulated HTTP 429 quota exhaustion.

### 🛡️ Phase 2: PHI Guardrails & Clinical RAG Engine
- [x] **Task 2.1:** Build `guardrails.ts` & `guardrails.py` (Regex + NER tokenizer for HIPAA PHI scrubbing and lethal dosage gate).
- [x] **Task 2.2:** Build `clinicalRag.ts` & `clinical_rag.py` (Qdrant Cloud vector search with 10 evidence-based guidelines).
- [x] **Task 2.3:** Build `citationResolver.ts` & `citation_resolver.py` (Verifies `[TAG]` citations and emits Grounding Fidelity score).

### 🧠 Phase 3: LangGraph Supervisor & Specialist Agents
- [x] **Task 3.1:** Define `state.ts` & `state.py` (StateGraph `AgentState` schema).
- [x] **Task 3.2:** Build `supervisor.ts` & `supervisor.py` (Intent routing with confidence floor $\ge 0.60$).
- [x] **Task 3.3:** Build `triageAgent.ts` & `triage_agent.py` (Manchester Triage System physiological rules).
- [x] **Task 3.4:** Build `riskAnalystAgent.ts` & `risk_analyst_agent.py` (XGBoost 30-day readmission + SHAP factors).
- [x] **Task 3.5:** Build `carePlanAgent.ts` & `care_plan_agent.py` (Autonomous 4-part post-discharge schedule).
- [x] **Task 3.6:** Build `medicationSafetyAgent.ts` & `medication_safety_agent.py` (Warfarin+NSAID, Metformin/eGFR blocker).

### 💾 Phase 4: Long-Term Memory & Active Learning
- [x] **Task 4.1:** Build `memory.ts` & `memory.py` (Mem0 Cloud REST API + local JSON mirror for patient-scoped recall).
- [x] **Task 4.2:** Build `feedbackAgent.ts` & `feedback_agent.py` (Clinician override tracking and $>15\%$ drift detection).

### 🖥️ Phase 5: Frontend Agent Cockpit UI
- [x] **Task 5.1:** Build `AgentCockpitView.tsx` with live StateGraph visualizer and 4 clinical test scenarios.
- [x] **Task 5.2:** Add multi-step reasoning log feed, citation badge inspector, and clinician review modal.
- [x] **Task 5.3:** Connect UI to Express API routes (`/api/agent/execute`, `/api/agent/feedback`).

### 📈 Phase 6: Observability, E2E Testing & Hackathon Packaging
- [x] **Task 6.1:** Build `observability.ts` (LangSmith-compatible run traces in `.runtime/traces/`).
- [x] **Task 6.2:** Build `evalRagas.ts` (RAGAS benchmark runner scoring Faithfulness, Context Precision, Relevancy).
- [x] **Task 6.3:** Write full E2E test suites in Python and TypeScript (`test_phase6_e2e.ts`).
- [x] **Task 6.4:** Generate `HACKATHON_SUBMISSION.md` and winning `README.md`.

---

## 🟡 NEW ROADMAP FROM DEEP AUDIT (Phases 7–10)

### 🔒 Phase 7: Critical Security & Configuration Hardening
- [x] **Task 7.1:** Eliminate client-side API key leakage — route all LLM requests through `server.ts` endpoint `/api/agent/run` and `/api/agent/llm-call`.
- [x] **Task 7.2:** Update `.env.example` to document all production keys (`GROQ_API_KEY`, `MEM0_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `LANGSMITH_API_KEY`).
- [x] **Task 7.3:** Clean all placeholder tokens (`[Project Name]`, `[Developer Name]`, `[YYYY-MM-DD]`, `XX`) from documentation files (`Architecture.md`, `TECHNICAL_ARCHITECTURE.md`, `FEATURE_TICKET_LIST.md`, `DEMO_SCRIPT.md`, `PRD_CLOSURE.md`).
- [x] **Task 7.4:** Commit Phase 7 changes locally (no push).

### 🇮🇳 Phase 8: Bharat Health Stack & Linguistic Accessibility
- [x] **Task 8.1:** Build `src/lib/agents/pmjayAgent.ts` — Ayushman Bharat PM-JAY eligibility verification agent (₹5,00,000 coverage check).
- [x] **Task 8.2:** Build `src/lib/agents/abhaAgent.ts` — Ayushman Bharat Digital Mission (ABDM) mock ID lookup agent with health record linking.
- [x] **Task 8.3:** Add Hindi Language Output Mode (Devanagari script) in Agent Cockpit with prompt optimization for ASHA workers.
- [x] **Task 8.4:** Mount Bharat agents in `server.ts` and test with Indian patient profiles.
- [x] **Task 8.5:** Commit Phase 8 changes locally (no push).

### 🤖 Phase 9: Real Function Calling & Autonomous Action Agents
- [x] **Task 9.1:** Upgrade `triageAgent.ts` to real Gemini Function Calling / Tool Use (`check_vitals`, `lookup_guideline`, `recommend_escalation`).
- [x] **Task 9.2:** Build `src/lib/agents/patientCommunicationAgent.ts` — Autonomous bilingual WhatsApp/SMS discharge & reminder draft generator with one-click send.
- [x] **Task 9.3:** Build `src/lib/agents/vitalsMonitorAgent.ts` — Autonomous background monitoring loop detecting simulated vitals deterioration (SpO2 drop to 88%) with instant alerts.
- [x] **Task 9.4:** Build `src/lib/agents/appointmentAgent.ts` — Autonomous follow-up appointment booking in the CareLink calendar for high-risk patients.
- [x] **Task 9.5:** Commit Phase 9 changes locally (no push).

### 🎨 Phase 10: Streaming Cockpit UX, AuRAG Pruning & Hackathon Polish
- [x] **Task 10.1:** Implement animated step-by-step agent execution visualization and typewriter response streaming in `AgentCockpitView.tsx`.
- [x] **Task 10.2:** Display PM-JAY card, ABHA ID badge, and WhatsApp follow-up preview inside the Cockpit.
- [x] **Task 10.3:** Prune unwanted industrial modules from `aurag/` (CAD parser, Bitcoin LNbits, pump SCADA) while keeping core agent references safe.
- [x] **Task 10.4:** Rehearse the 3-minute winning demo flow (CHF $\rightarrow$ Vitals Alert $\rightarrow$ Hindi Plan $\rightarrow$ WhatsApp Send).
- [x] **Task 10.5:** Final git commit locally (no push).

---

## 🚀 TRACK 2: LIVEKIT VOICE ESCALATION & SARVAM AI (Phases 11–15)

### 🎙️ Phase 11: LiveKit Docs MCP Integration & Telephony SDK Setup
- [x] **Task 11.1:** Register official LiveKit Docs MCP server (`https://docs.livekit.io/mcp`) in `.vscode/mcp.json`, `.cursor/mcp.json`, and `mcp_servers.json`.
- [x] **Task 11.2:** Install `livekit-server-sdk` and real-time telephony packages.
- [x] **Task 11.3:** Create server-side telephony client adapter (`src/lib/telephony/livekitClient.ts`) supporting mock and live modes.
- [x] **Task 11.4:** Update `.env.example` with LiveKit and SIP configuration keys.
- [x] **Task 11.5:** Commit Phase 11 changes locally (no push).

### 🇮🇳 Phase 12: Sarvam AI Indic Multi-Language Translation & Voice System
- [x] **Task 12.1:** Create `src/lib/agents/sarvamIndicAgent.ts` supporting Sarvam AI Indic API (`SARVAM_API_KEY`) across 10 Indian languages.
- [x] **Task 12.2:** Build deterministic clinical fallback for all 10 languages for 100% reliable demo/mock testing.
- [x] **Task 12.3:** Mount Express endpoints in `server.ts` (`/api/agent/sarvam/translate`, `/api/agent/sarvam/tts`).
- [x] **Task 12.4:** Build verification test suite `scripts/test_phase12_sarvam.ts`.
- [x] **Task 12.5:** Commit Phase 12 changes locally (no push).

### 📞 Phase 13: Closed-Loop Critical Escalation Engine & Call Policy
- [x] **Task 13.1:** Build `src/lib/telephony/callPolicy.ts` with critical-only filter, idempotency key, cooldown (300s), and max attempts.
- [x] **Task 13.2:** Build `src/lib/telephony/escalationService.ts` (`placeEscalationCall` dispatching LiveKit agent and connecting SIP participant).
- [x] **Task 13.3:** Add Supabase / in-memory call state table (`alert_escalation_calls`).
- [x] **Task 13.4:** Mount telephony endpoints in `server.ts` (`/api/telephony/escalate`, `/api/telephony/call`, `/api/telephony/calls/:id`).
- [x] **Task 13.5:** Commit Phase 13 changes locally (no push).

### 🎙️ Phase 14: LiveKit Real-Time Escalation Voice Agent & Signed Webhook Reducer
- [x] **Task 14.1:** Build `voice-agent/` LiveKit agent module with prompt constraints, conversational acknowledgement listener, and timeout fallback.
- [x] **Task 14.2:** Implement signed webhook endpoint `POST /api/webhooks/livekit` validating authorization tokens and updating call state reducer.
- [x] **Task 14.3:** Build verification test script `scripts/test_phase14_webhooks.ts`.
- [x] **Task 14.4:** Commit Phase 14 changes locally (no push).

### 🖥️ Phase 15: Critical Escalation UI Panel & Closed-Loop Timeline in Cockpit
- [x] **Task 15.1:** Add "LiveKit Critical Escalation Panel" in `AgentCockpitView.tsx` with live call status pill, duration timer, and action buttons.
- [x] **Task 15.2:** Add "Critical Escalation Audit Timeline" visualizing the complete closed loop.
- [x] **Task 15.3:** Connect simulated acute SpO2 drop button to trigger the escalation call workflow.
- [x] **Task 15.4:** Complete documentation (`docs/TELEPHONY.md`, `docs/TELEPHONY_TESTING.md`) and verify end-to-end regression.
- [x] **Task 15.5:** Final git commit locally (no push).

---

## 🇮🇳 EXTENSION: DIGITAL INDIA BHASHINI (MeitY) & SARVAM AI DUAL-ENGINE
- [x] **Task B.1:** Integrate Government of India's Digital India Bhashini API (`src/lib/agents/bhashiniAgent.ts`) with ULCA/Dhruva pipeline resolution and IndicTrans2 NMT + Indic-TTS.
- [x] **Task B.2:** Support all 22 official scheduled Indian languages under the 8th Schedule of the Constitution of India.
- [x] **Task B.3:** Build Unified Indic Gateway (`src/lib/agents/indicUnifiedGateway.ts`) with zero-latency auto-failover (`auto` | `bhashini` | `sarvam`).
- [x] **Task B.4:** Mount Express endpoints (`/api/agent/bhashini/*`, `/api/agent/indic/*`) and update `AgentCockpitView.tsx` with dual-engine provider selector and audio preview.
- [x] **Task B.5:** Build automated test suite (`scripts/test_bhashini_integration.ts`) passing 28/28 tests (100% green).
- [x] **Task B.6:** Local git commit without pushing.

---

*Master Task Tracker updated for Bharat Agentic 2026 by Nishant Maurya.*
