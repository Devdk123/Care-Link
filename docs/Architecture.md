# 🏗️ CareLink System Architecture

> **Project:** CareLink — Autonomous Multi-Agent HealthTech Platform  
> **Event:** Bharat Agentic 2026 | AIKart 12-Hour Hackathon  
> **Version:** 3.0.0-Agentic  
> **Last Updated:** 2026-09-29  
> **Architect:** Nishant Maurya ([nishantma05@gmail.com](mailto:nishantma05@gmail.com))  

---

## 📊 1. System Overview

### Architecture Pattern
- [x] **Modular Monolith with Decoupled Agent Pipeline** — Frontend (React 19 + Vite), Server-Side Gateway & SSR (Express.js), Multi-Agent Pipeline (LangGraph Supervisor + 8 Specialists), Vector Store (Qdrant Cloud), Memory (Mem0), and Database (Supabase PostgreSQL with RLS).

### Why This Architecture?
CareLink is built for high-stakes healthcare operations where latency, auditability, data privacy, and deterministic safety are paramount. A distributed multi-service setup introduces network points of failure during emergency triage; a modular monolith with server-side LLM failover ensures $<500\text{ ms}$ response times, zero client-side API key leakage, and complete compliance with HIPAA and India's Digital Personal Data Protection (DPDP) Act.

---

## 🗺️ 2. High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                   CLIENTS / BEDSIDE UI                   │
│                                                          │
│   ┌────────────────────────┐  ┌──────────────────────┐  │
│   │ Clinician Agent Cockpit│  │ Rural ASHA Mode (HI) │  │
│   │ (React 19 + Recharts)  │  │ (Simple Hindi Views) │  │
│   └───────────┬────────────┘  └──────────┬───────────┘  │
└───────────────┼──────────────────────────┼──────────────┘
                │ HTTPS (Port 3005)        │
                ▼                          ▼
┌──────────────────────────────────────────────────────────┐
│             EXPRESS API GATEWAY (server.ts)              │
│       • Rate Limiting    • Zero-Key Client Security      │
│       • Session Auth     • Correlation ID Tracing        │
└───────────────┬──────────────────────────┬───────────────┘
                │                          │
    ┌───────────▼───────────┐      ┌───────▼───────────────┐
    │  HIPAA & Aadhaar PHI  │      │ Supabase PostgreSQL   │
    │  Guardrails Scrubber  │      │ • Patient EHR Schema  │
    └───────────┬───────────┘      │ • Row-Level Security  │
                │                  │ • Audit Log Ledger    │
    ┌───────────▼───────────┐      └───────────────────────┘
    │  LangGraph Supervisor │
    │  StateGraph Router    │
    └───────────┬───────────┘
                │
   ┌────────────┼────────────┬────────────┬────────────┐
   ▼            ▼            ▼            ▼            ▼
[Triage]    [Risk ML]   [CarePlan]   [MedSafety]   [Bharat]
(MTS Tool) (XGB+SHAP)   (4-Part)     (DDI Gate)   (ABHA/PMJAY)
   │            │            │            │            │
   └────────────┴────────────┼────────────┴────────────┘
                             │
            ┌────────────────▼────────────────┐
            │ Dual-Model Resilient Gateway    │
            │ Gemini 2.5 ⚡ Groq Cloud Failover│
            └────────────────┬────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Qdrant Vector   │ │ Mem0 Memory     │ │ Observability   │
│ 10 Guidelines   │ │ Cross-Session   │ │ LangSmith /     │
│ [ICMR/AHA/WHO]  │ │ Patient Recall  │ │ RAGAS Benchmark │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 🛠️ 3. Full Technology Stack

### Frontend Layer
- **Framework:** React 19.0.0
- **Build Tool:** Vite 6.2.0
- **Styling:** Tailwind CSS v4, Lucide React Icons
- **Data Visualization:** Recharts, GSAP, Motion
- **Design System:** Pure Light Mode matching `nissh.info` (`#fbf9f5` / `#f8fafc`, soft borders, delicate pills)

### Application & API Gateway
- **Runtime:** Node.js 20.x LTS + TypeScript 5.8
- **Server:** Express.js 4.x running in `server.ts`
- **Security:** In-memory PHI tokenization, strict CORS, rate limiters, server-side environment isolation

### AI & Agent Pipeline
- **Orchestrator:** LangGraph `StateGraph` pattern (`supervisor.ts`)
- **Primary LLM:** Google Gemini 2.5 Flash
- **Failover LLM:** Groq Cloud (`openai/gpt-oss-120b`, `llama-3.3-70b-versatile`)
- **Knowledge Engine:** Qdrant Cloud (Cosine similarity + in-memory fallback)
- **Long-Term Memory:** Mem0 Cloud REST API (`.runtime/mem0/` fallback)
- **Evaluation:** RAGAS (Faithfulness, Context Precision, Answer Relevancy)

### Machine Learning & Data
- **Readmission Model:** XGBoost classifier (ROC-AUC 0.727, 86 clinical features)
- **Explainability:** SHAP waterfall and feature attributions
- **Federated Training:** Flower Framework across 3 hospital nodes
- **Database:** Supabase PostgreSQL with Row-Level Security (RLS)

---

*CareLink Architecture Documentation — Bharat Agentic 2026.*
