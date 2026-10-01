# 📝 CareLink Project Changelog

> All notable changes to **CareLink** are documented here.  
> Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)  
> Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)  

## [3.1.0-Autonomous] — 2026-09-29 🤖 Full Autonomous & Bharat Health Stack Release

### ✨ Added
- **Server-Side API Key Proxy:** Zero-leak backend endpoint `/api/agent/llm-call` insulating Gemini and Groq API keys completely from client bundles.
- **Ayushman Bharat PM-JAY Agent:** Seamless ₹5,00,000 cashless entitlement verification, deprivation criteria check, and HBP 2.2 procedure rate packages mapping.
- **ABDM ABHA Health ID Agent:** 14-digit ABHA identity verification, UIDAI KYC status verification, and longitudinal multi-hospital EHR record discovery.
- **Linguistic Accessibility (Hindi ASHA Mode):** One-click bilingual Devanagari Hindi output across Triage, Care Plan, and Risk Analyst prompts tailored for grassroots ASHA community workers.
- **Real Tool Calling TriageAgent:** Real multi-step tool execution with `check_vitals`, `lookup_guideline`, and `recommend_escalation`.
- **Autonomous Patient Communication Agent:** Bilingual WhatsApp/SMS post-discharge instruction generator with direct click-to-dispatch `wa.me` deep links and medication schedule mapping.
- **Autonomous Telemetry Anomaly Loop:** Continuous telemetry monitoring detecting acute SpO2 drops ($\le 88\%$) or hypertensive emergencies with $< 5\text{ min}$ SLA alerts.
- **Autonomous Hospital EHR Scheduler:** Auto-books post-discharge outpatient follow-up specialist slots (`APT-2026-XXXX`) for high-risk patients.
- **Progressive Streaming Cockpit UX:** Animated step-by-step reasoning trace disclosure (110ms staggered delay), typewriter response streaming (18ms chunks) with pulsing terminal cursor, and instantaneous `⚡ Skip Stream` action.
- **AuRAG Industrial Pruning:** Cleaned non-health CAD parsers and Bitcoin LNbits modules while preserving 100% of CareLink healthcare features.

---

## [3.0.0-Agentic] — 2026-09-29 🏆 Bharat Agentic 2026 Major Upgrade

### ✨ Added
- **Resilient Dual-Model Gateway:** Gemini 2.5 Flash primary with instant $<500\text{ ms}$ auto-failover to Groq (`openai/gpt-oss-120b`).
- **HIPAA & Aadhaar PHI Scrubber:** Regex + NER tokenization protecting patient names, MRNs, phones, and Indian Aadhaar numbers.
- **Clinical RAG Engine:** Qdrant Cloud vector search indexing 10 peer-reviewed guidelines (ICMR, AHA, WHO, KDIGO, NICE).
- **Citation Resolver:** Verifies bracketed citations `[TAG]` and scores Grounding Fidelity ($0.0 - 1.0$).
- **LangGraph Supervisor Router:** Intent classification with confidence floor $\ge 0.60$ and MTS Triage fallback.
- **Specialist Agent Cluster:** Triage Agent, Risk Analyst Agent (XGBoost + SHAP), Care Plan Agent, and Medication Safety Agent (DDI blocker).
- **Long-Term Memory:** Mem0 Cloud REST API integration with session-scoped history recall.
- **Active Learning Feedback Loop:** Clinician override tracking with $>15\%$ model drift detection.
- **Observability:** LangSmith-compatible run trace exports in `.runtime/traces/` and RAGAS evaluation runner.
- **Frontend Agent Cockpit:** Interactive React 19 visualizer with live StateGraph telemetry and 4 clinical scenarios.

---

## [2.5.0] — 2026-08-20

### ✨ Added
- Federated learning pipeline across 3 hospital nodes (Apollo, Fortis, Max) using Flower Framework.
- Differential privacy accountant ($\epsilon = 1.2, \delta = 10^{-5}$) with FedAvg gradient aggregation.
- XGBoost readmission classifier with Optuna hyperparameter optimization (ROC-AUC 0.727).
- SHAP feature attribution waterfall visualization in patient profile.

---

## [1.0.0] — 2026-07-15 🎉 Initial Release

### ✨ Added
- React 19 + Vite responsive clinical portal.
- Supabase PostgreSQL integration with Row-Level Security (RLS).
- Patient roster, appointment calendar, and department analytics.

---

*CareLink Changelog — Maintained by Nishant Maurya.*
