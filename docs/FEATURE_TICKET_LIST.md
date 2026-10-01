# 🎫 CareLink — Feature Ticket & Sprint Milestone List

> **Project:** CareLink — Autonomous Multi-Agent HealthTech Platform  
> **Event:** Bharat Agentic 2026 | AIKart 12-Hour Hackathon  
> **Version Target:** v3.0.0-Bharat-Agentic  
> **Last Updated:** 2026-09-29  
> **Lead Architect & Developer:** Nishant Maurya ([nishantma05@gmail.com](mailto:nishantma05@gmail.com))  
> **Status:** 🟢 Active Sprint  

---

## 📌 Status Legend

| Symbol | Meaning | Symbol | Meaning |
|:---:|---|:---:|---|
| 🔴 | Critical / P0 | ✅ | Done & Verified |
| 🟠 | High / P1 | 🔄 | In Progress |
| 🟡 | Medium / P2 | ⬜ | Ready for Next Phase |

---

## 📊 Milestone Summary

| Epic ID | Epic Title | Priority | Status | Tickets Done / Total |
|---|---|:---:|:---:|:---:|
| **EPIC-01** | Dual-Model Resilient Failover Gateway | 🔴 Critical | ✅ Done | 4 / 4 |
| **EPIC-02** | HIPAA & Aadhaar PHI Guardrails Engine | 🔴 Critical | ✅ Done | 3 / 3 |
| **EPIC-03** | Qdrant Cloud Clinical RAG & Citations | 🔴 Critical | ✅ Done | 4 / 4 |
| **EPIC-04** | LangGraph Supervisor & Specialist Agents | 🔴 Critical | ✅ Done | 6 / 6 |
| **EPIC-05** | Mem0 Long-Term Memory & Active Learning | 🟠 High | ✅ Done | 3 / 3 |
| **EPIC-06** | Agent Cockpit UI & Observability Engine | 🟠 High | ✅ Done | 4 / 4 |
| **EPIC-07** | Critical Security Hardening & Zero-Leak Proxy | 🔴 Critical | 🔄 In Progress | 2 / 4 |
| **EPIC-08** | Bharat Health Stack (ABHA, PM-JAY & Hindi) | 🔴 Critical | ⬜ Sprint Ready | 0 / 4 |
| **EPIC-09** | Gemini Tool-Use & Autonomous Action Agents | 🔴 Critical | ⬜ Sprint Ready | 0 / 4 |
| **EPIC-10** | Streaming UX, AuRAG Pruning & Demo Polish | 🟠 High | ⬜ Sprint Ready | 0 / 4 |

---

## 🔐 EPIC-01: Dual-Model Resilient Failover Gateway
- **TICKET-101 (✅ Done):** Implement `failoverLlm.ts` wrapping Gemini 2.5 Flash with Groq Cloud failover.
- **TICKET-102 (✅ Done):** Add latency timer, token consumption estimation, and USD cost tracking.
- **TICKET-103 (✅ Done):** Configure secondary models (`llama-3.3-70b-versatile`, `openai/gpt-oss-120b`).
- **TICKET-104 (✅ Done):** Write unit test suite `test_failover.ts` verifying $<500\text{ ms}$ failover on HTTP 429.

---

## 🛡️ EPIC-02: HIPAA & Aadhaar PHI Guardrails Engine
- **TICKET-201 (✅ Done):** Build regex and NER tokenizers in `guardrails.ts` scrubbing names, MRNs, phone numbers.
- **TICKET-202 (✅ Done):** Add Indian 12-digit Aadhaar number detection and masking pattern (`[AADHAAR_XXXX]`).
- **TICKET-203 (✅ Done):** Implement in-memory token map for local round-trip de-tokenization.

---

## 📚 EPIC-03: Qdrant Cloud Clinical RAG & Citations
- **TICKET-301 (✅ Done):** Connect Qdrant Cloud vector collection `carelink_guidelines` with cosine distance.
- **TICKET-302 (✅ Done):** Seed 10 clinical guidelines (ICMR, WHO, NICE, AHA, KDIGO, IAP, GOLD).
- **TICKET-303 (✅ Done):** Implement in-memory cosine fallback for zero-offline downtime.
- **TICKET-304 (✅ Done):** Build `citationResolver.ts` computing Grounding Fidelity ($0.0 - 1.0$) with evidence badges.

---

## 🧠 EPIC-04: LangGraph Supervisor & Specialist Agents
- **TICKET-401 (✅ Done):** Build `supervisor.ts` StateGraph router with confidence floor $\ge 0.60$.
- **TICKET-402 (✅ Done):** Build `triageAgent.ts` for Manchester Triage System physiological evaluation.
- **TICKET-403 (✅ Done):** Build `riskAnalystAgent.ts` translating XGBoost + SHAP feature attributions into narrative.
- **TICKET-404 (✅ Done):** Build `carePlanAgent.ts` creating 4-part discharge schedule (meds, visits, diet, red flags).
- **TICKET-405 (✅ Done):** Build `medicationSafetyAgent.ts` blocking Warfarin+NSAIDs and Metformin/eGFR contraindications.
- **TICKET-406 (✅ Done):** Write E2E test verification scripts in TypeScript and Python.

---

## 💾 EPIC-05: Mem0 Long-Term Memory & Active Learning
- **TICKET-501 (✅ Done):** Connect Mem0 Cloud REST API with local `.runtime/mem0/` JSON mirror fallback.
- **TICKET-502 (✅ Done):** Build `feedbackAgent.ts` tracking clinician approvals vs. overrides.
- **TICKET-503 (✅ Done):** Implement moving drift alert when override rate $\rho > 15\%$.

---

## 🖥️ EPIC-06: Agent Cockpit UI & Observability Engine
- **TICKET-601 (✅ Done):** Build `AgentCockpitView.tsx` with live StateGraph visualizer and clinical scenarios.
- **TICKET-602 (✅ Done):** Implement step-by-step reasoning feed and citation badge inspector modal.
- **TICKET-603 (✅ Done):** Add LangSmith run trace exports in `.runtime/traces/`.
- **TICKET-604 (✅ Done):** Build RAGAS benchmark runner scoring Faithfulness ($>0.80$) and Context Precision.

---

## 🔒 EPIC-07: Critical Security Hardening & Zero-Leak Proxy
- **TICKET-701 (🔄 In Progress):** Route all LLM requests through `server.ts` endpoint `/api/agent/run`.
- **TICKET-702 (✅ Done):** Update `.env.example` with all production configuration keys.
- **TICKET-703 (✅ Done):** Clean documentation files of template placeholder text.
- **TICKET-704 (⬜ Ready):** Verify zero API keys exist in client browser bundle.

---

## 🇮🇳 EPIC-08: Bharat Health Stack (ABHA, PM-JAY & Hindi)
- **TICKET-801 (⬜ Ready):** Build `pmjayAgent.ts` for Ayushman Bharat ₹5,00,000 coverage check.
- **TICKET-802 (⬜ Ready):** Build `abhaAgent.ts` for ABDM profile lookup and health record linking.
- **TICKET-803 (⬜ Ready):** Add Hindi Language Toggle in Agent Cockpit with prompt optimization for ASHA workers.
- **TICKET-804 (⬜ Ready):** Connect Bharat agents to `server.ts` and test with Indian patient profiles.

---

## 🤖 EPIC-09: Gemini Tool-Use & Autonomous Action Agents
- **TICKET-901 (⬜ Ready):** Convert `triageAgent.ts` to native Gemini Function Calling (`check_vitals`, `lookup_guideline`).
- **TICKET-902 (⬜ Ready):** Build `patientCommunicationAgent.ts` for bilingual WhatsApp/SMS discharge drafting.
- **TICKET-903 (⬜ Ready):** Build `vitalsMonitorAgent.ts` for telemetry anomaly loop with simulated SpO2 drop alert.
- **TICKET-904 (⬜ Ready):** Build `appointmentAgent.ts` for autonomous follow-up slot booking in the EHR calendar.

---

## 🎨 EPIC-10: Streaming UX, AuRAG Pruning & Demo Polish
- **TICKET-1001 (⬜ Ready):** Add typewriter response streaming and animated execution step cards in UI.
- **TICKET-1002 (⬜ Ready):** Display PM-JAY card, ABHA ID badge, and WhatsApp follow-up preview in Cockpit.
- **TICKET-1003 (⬜ Ready):** Prune unwanted industrial modules from `aurag/` (CAD, Bitcoin LNbits, pump SCADA).
- **TICKET-1004 (⬜ Ready):** Rehearse 3-minute hackathon demo flow.

---

*CareLink Feature Ticket List — Bharat Agentic 2026.*
