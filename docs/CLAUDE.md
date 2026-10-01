# 🏥 CLAUDE.md — CareLink

> Context file for AI assistants working on the CareLink clinical codebase.  
> **Event:** Bharat Agentic 2026 — AIKart 12-Hour Autonomous Agent Hackathon  
> **Author:** Nishant Maurya ([nishantma05@gmail.com](mailto:nishantma05@gmail.com))

---

## 🎯 Project Overview

**CareLink** is a production-grade, 12-layer autonomous multi-agent clinical copilot that:
1. **Predicts Patient Readmissions** using federated EHR telemetry and clinical risk models.
2. **Blocks Lethal Drug-Drug Interactions (DDI)** deterministically before prescriptions are issued.
3. **Generates Grounded Discharge Care Plans** with citation fidelity ($>0.85$) verified against ICMR, WHO, and Harrison's Principles.
4. **Executes Autonomous Closed-Loop Telephony Escalations** using **LiveKit SIP Outbound Trunking** when acute decompensation occurs ($\text{SpO}_2 \le 88\%$).
5. **Speaks & Translates across 22 Scheduled Indian Languages** using **Digital India Bhashini (MeitY)** and **Sarvam AI Indic Foundation Stack** with dynamic auto-failover.
6. **Enforces Strict Healthcare Safety & Privacy** — zero patient data leak (PII/HIPAA sanitization), deterministic fallback safeguards.

---

## 🏗️ Tech Stack & Architecture

- **Frontend:** React 19, TypeScript 5.8, Vite 6.2, Tailwind CSS v4, Lucide React, GSAP, Recharts
- **Backend API:** Node.js, Express 4.21, TypeScript (`tsx server.ts`)
- **Multi-Agent Runtime:**
  - `supervisor.ts`: Central routing engine (Triage, Risk, Medication Safety, Care Plan)
  - `failoverLlm.ts`: Dual-engine LLM failover (Google Gemini 2.5 Flash ⚡ Groq Cloud LLaMA 3.3)
  - `clinicalRag.ts`: Hybrid dense vector retrieval + Qdrant Cloud RAG with clinical grounding
  - `guardrails.ts`: OWASP Top 10 + clinical refusal guards
- **Telephony & Realtime Voice:**
  - `src/lib/telephony/livekitClient.ts`: LiveKit Server SDK integration & SIP dispatch
  - `src/lib/telephony/callPolicy.ts`: Critical-only gate, idempotency lock, 300s cooldown
  - `src/lib/telephony/escalationService.ts`: Closed-loop lifecycle manager
  - `src/lib/telephony/webhookHandler.ts`: Signed LiveKit webhook reducer
- **Indic AI Dual-Engine:**
  - `src/lib/agents/bhashiniAgent.ts`: Government of India Digital India Bhashini (MeitY / NLTM)
  - `src/lib/agents/sarvamIndicAgent.ts`: Sarvam AI (`mayura:v1`, `bulbul:v1`)
  - `src/lib/agents/indicUnifiedGateway.ts`: Auto-failover gateway across 22 scheduled Indian languages
- **Storage & Identity:** Supabase (Auth, RLS, PostgreSQL), ABHA Profile, PM-JAY Registry

---

## 🚀 Key Commands

```bash
# Development server (Express + Vite)
npm run dev

# Client build (Production Vite bundle)
npm run build:client

# Full build (Client + Server bundle)
npm run build

# TypeScript Lint / Typecheck
npm run lint

# Telephony & LiveKit test suites
npx tsx scripts/test_phase11_livekit_sdk.ts
npx tsx scripts/test_phase12_sarvam.ts
npx tsx scripts/test_phase13_escalation.ts
npx tsx scripts/test_phase14_webhooks.ts

# Bhashini & Indic Dual-Engine test suite
npx tsx scripts/test_bhashini_integration.ts
```

---

## 🔒 Constraints & Development Rules

1. **NO GIT PUSH:** All git commits must be made strictly **locally** (`git commit`). Never push to remote.
2. **Zero Breakage:** All existing RAG pipelines, multi-agent flows, and live mock fallbacks must remain 100% green.
3. **Mock Reliability:** Every telephony and Indic AI module includes high-fidelity deterministic/mock modes so tests and demos run without external API failures.
