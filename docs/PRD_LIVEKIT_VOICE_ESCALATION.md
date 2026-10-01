# 📋 CareLink PRD v4.0 — LiveKit Closed-Loop Voice Escalation & Sarvam AI Indic Multilingual System

> **Project Name:** CareLink — Autonomous Multi-Agent HealthTech Platform  
> **Upgrade Target:** Closed-Loop Telephony Escalation (LiveKit) + Sarvam AI Indic Multilingual Platform  
> **Event:** Bharat Agentic 2026 | AIKart 12-Hour Autonomous Agent Hackathon  
> **Author & Lead:** Nishant Maurya ([nishantma05@gmail.com](mailto:nishantma05@gmail.com))  
> **Status:** 🟢 Approved Specification — Phased Execution Blueprint (Phases 11–15)  
> **Baseline Reference:** [`CareLink_LiveKit_Call_And_Hackathon_Upgrade_Spec.pdf`](file:///c:/Users/nisha/OneDrive/Documents/Downloads/carelink/public/CareLink_LiveKit_Call_And_Hackathon_Upgrade_Spec.pdf)  

---

## 🧭 Executive Summary

CareLink already features a proven 12-layer multi-agent architecture:
- Gemini 2.5 Flash ⚡ Groq Failover Gateway (<500ms)
- HIPAA Regex+NER PHI Scrubber
- Qdrant Cloud Clinical RAG (10 guidelines)
- LangGraph Supervisor StateGraph Router
- Mem0 Long-Term Memory
- Clinician Active Learning Drift Monitor (>15%)
- PM-JAY Ayushman Bharat ₹5L Cashless Eligibility Checker
- ABDM 14-digit ABHA Identity Profile Lookup
- Gemini Function Calling TriageAgent
- Autonomous WhatsApp Discharge Dispatcher
- Autonomous Telemetry SpO2 Drop Monitor
- Autonomous EHR Specialist Slot Booking

### The Critical Gap: Closing the Action Loop
In real hospital ICU/ward monitoring, showing an alert on a dashboard screen is not enough. If an on-call physician is away from their terminal when a patient's oxygen drops critically (e.g. SpO2 ≤ 88%), every minute of delay increases mortality.

**CareLink v4.0 introduces Closed-Loop Voice Escalation via LiveKit Telephony + Sarvam AI Indic Multilingual AI**:
When critical physiological deterioration occurs, CareLink does not just display a red banner — it **autonomously places an outbound phone call to the on-call physician**, delivers a concise 25-second clinical alert, **captures verbal acknowledgement ("acknowledge", "I am handling it") or DTMF 1**, and registers an immutable audit trail. If the call goes unanswered or busy, CareLink automatically escalates down the secondary on-call roster.

Simultaneously, through **Sarvam AI**, CareLink gains native high-precision translation, text-to-speech, and language understanding across **10 Indian languages** (Hindi, Tamil, Telugu, Bengali, Kannada, Marathi, Gujarati, Malayalam, Odia, Punjabi), empowering rural ASHA healthcare workers across Bharat.

---

## 🏗️ Closed-Loop Telephony Architecture Flow

```
   ┌─────────────────────────────────────────────────────────────┐
   │  Acute Patient Telemetry Anomaly (SpO2 <= 88% / SBP >= 180)  │
   └──────────────────────────────┬──────────────────────────────┘
                                  │
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │        Layer 13: Critical Alert Orchestrator & Policy        │
   │  • Critical-Only Filter   • Idempotency (1 call / alertId)   │
   │  • 300s Cooldown Window   • Allowlisted Numbers in Demo      │
   └──────────────────────────────┬──────────────────────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
   ┌─────────────────────────────┐ ┌─────────────────────────────┐
   │ LiveKit Agent Dispatch      │ │ Sarvam AI Indic Engine      │
   │ • Room: carelink-alert-{id} │ │ • Indic Translation         │
   │ • Create SIP Participant    │ │ • Regional Audio Alert      │
   └──────────────┬──────────────┘ └──────────────┬──────────────┘
                  │                               │
                  ▼                               │
   ┌─────────────────────────────┐                │
   │ Outbound SIP Trunk / PSTN   │                │
   │ • Verified Caller DID       │                │
   └──────────────┬──────────────┘                │
                  │                               │
                  ▼                               │
   ┌─────────────────────────────┐                │
   │ On-Call Clinician Mobile    │◄───────────────┘
   │ • Rings in < 5 seconds      │
   │ • LiveKit Realtime Agent    │
   │   speaks concise facts      │
   └──────────────┬──────────────┘
                  │
                  ▼
   ┌─────────────────────────────┐
   │ Clinician Voice Response    │
   │ "Acknowledge" / DTMF 1      │
   └──────────────┬──────────────┘
                  │
                  ▼
   ┌─────────────────────────────┐
   │ LiveKit Webhook & Reducer   │
   │ • Signature Validation      │
   │ • State: ACKNOWLEDGED       │
   │ • Timeline Audit Record     │
   └─────────────────────────────┘
```

---

## 🔒 Voice Agent Safety & Privacy Rules (Non-Negotiable)

1. **Minimum Necessary Data:** Never transmit patient full names, MRNs, dates of birth, or sensitive history over telephony. Send only synthetic case references (`CASE-104`), ward (`ICU-4A`), bed (`Bed 12`), and immediate physiological facts (SpO2 78%, HR 132).
2. **Zero Hallucination / No Prescriptions:** The voice agent reads only server-verified facts. It is strictly prohibited from diagnosing new conditions, prescribing medications, or recommending dosage alterations on the call.
3. **Identification & Brevity:** Every call begins: *"This is CareLink automated clinical escalation. Critical alert for case CASE-104..."* Initial delivery is kept strictly under 25 seconds.
4. **Natural Acknowledgement:** Accepts conversational affirmative phrases ("acknowledge", "I'm on it", "I am handling it") and DTMF keypad input (`1`).
5. **Deterministic Mock Mode (`TELEPHONY_MODE=mock`):** Enables full CI/CD testing, instant hackathon evaluation, and offline demonstrations with 100% reproducible state machine transitions.

---

## 📦 Master Phased Implementation Roadmap (Phases 11–15)

### 🎙️ Phase 11: LiveKit Docs MCP Integration & Telephony SDK Setup
- **Task 11.1:** Configure LiveKit Docs MCP (`https://docs.livekit.io/mcp`) in `.vscode/mcp.json`, `.cursor/mcp.json`, and `mcp_servers.json`.
- **Task 11.2:** Install `livekit-server-sdk` and LiveKit real-time telephony packages.
- **Task 11.3:** Create server-side telephony client adapter (`src/lib/telephony/livekitClient.ts`) supporting both mock and live modes.
- **Task 11.4:** Update `.env.example` with LiveKit and SIP configuration keys.

### 🇮🇳 Phase 12: Sarvam AI Indic Multi-Language Translation & Voice System
- **Task 12.1:** Create `src/lib/agents/sarvamIndicAgent.ts` supporting Sarvam AI Indic API (`SARVAM_API_KEY`) across 10 languages (Hindi, Tamil, Telugu, Bengali, Kannada, Marathi, Gujarati, Malayalam, Odia, Punjabi).
- **Task 12.2:** Build deterministic clinical fallback for all 10 languages so the system functions with 100% green tests in demo/mock mode.
- **Task 12.3:** Mount Express endpoints in `server.ts`:
  - `POST /api/agent/sarvam/translate`
  - `POST /api/agent/sarvam/tts`
  - `GET /api/agent/sarvam/languages`
- **Task 12.4:** Build verification test suite `scripts/test_phase12_sarvam.ts`.

### 📞 Phase 13: Closed-Loop Critical Escalation Engine & Call Policy
- **Task 13.1:** Build `src/lib/telephony/callPolicy.ts` with strict safety rules:
  - Critical-only gate (only `severity: "CRITICAL"` or `urgencyLevel: "Emergency"` can initiate a call)
  - Idempotency key per `alertId` (prevent duplicate concurrent calls)
  - Cooldown window (300 seconds) and maximum attempt limits (2 attempts)
  - Allowlisted demo phone numbers
- **Task 13.2:** Build `src/lib/telephony/escalationService.ts`:
  - `placeEscalationCall(alertPayload)` dispatching LiveKit agent and connecting SIP participant.
- **Task 13.3:** In-memory & Supabase call state table:
  - Lifecycle: `queued` $\rightarrow$ `ringing` $\rightarrow$ `active` $\rightarrow$ `acknowledged` $\rightarrow$ `escalated` $\rightarrow$ `ended`.
- **Task 13.4:** Mount telephony endpoints in `server.ts`:
  - `POST /api/telephony/escalate`
  - `POST /api/telephony/call`
  - `GET /api/telephony/calls/:id`
  - `GET /api/telephony/calls?active=true`

### 🎙️ Phase 14: LiveKit Real-Time Escalation Voice Agent & Signed Webhooks
- **Task 14.1:** Build `voice-agent/` LiveKit agent module with prompt constraints, conversational acknowledgement listener, and timeout fallback.
- **Task 14.2:** Implement signed webhook endpoint `POST /api/webhooks/livekit` validating authorization tokens and updating the call state reducer.
- **Task 14.3:** Build verification test script `scripts/test_phase13_14_telephony.ts`.

### 🖥️ Phase 15: Critical Escalation UI Panel & Closed-Loop Timeline in Cockpit
- **Task 15.1:** Add "LiveKit Critical Escalation Panel" in `src/views/AgentCockpitView.tsx`:
  - Shows real-time call status pill (`RINGING` / `CALL IN PROGRESS` / `ACKNOWLEDGED`)
  - Target physician role badge ("On-Call Intensivist")
  - Live call duration timer
  - "🚨 Trigger Outbound Doctor Call" action button
  - "🧪 Test Call (Mock Mode)" button
- **Task 15.2:** Add "Critical Escalation Audit Timeline":
  - `[00:00]` Deterioration Detected ($\text{SpO}_2 = 78\%$)
  - `[00:02]` LiveKit Dispatch Created & SIP Participant Dialed
  - `[00:08]` Call Answered by Dr. Nishant Maurya
  - `[00:18]` Verbal Acknowledgement Received ("I am handling it")
  - `[00:20]` Closed-Loop Resolved & Logged in Audit Trail
- **Task 15.3:** Wire simulated acute SpO2 drop button to trigger the escalation flow.
- **Task 15.4:** Complete documentation (`docs/TELEPHONY.md`, `docs/TELEPHONY_TESTING.md`) and verify end-to-end regression.

---

## 🎬 90-Second Hackathon Judge Wow Sequence

1. **Dashboard Baseline:** Show 48 patients, Sunita Sharma (CHF), and STABLE drift status.
2. **Acute Deterioration:** Click "🚨 Simulate Acute SpO2 Drop (88%)" — Vitals plummet to 78% on telemetry.
3. **Autonomous Outbound Dialing:** Without human intervention, the Critical Escalation Orchestrator initiates an outbound LiveKit call to the on-call doctor. The Cockpit displays `CALLING ON-CALL INTENSIVIST (Room: carelink-alert-XXX)`.
4. **Phone Rings & Voice Alert:** The clinician's phone rings. The LiveKit voice agent speaks the concise alert facts in 20 seconds.
5. **Verbal Acknowledgement:** The doctor speaks: *"Acknowledge, I'm at bed 12."*
6. **Closed-Loop Resolved:** The dashboard updates in real time to `ACKNOWLEDGED`, stopping the escalation ladder and saving the audit trace.
7. **Bharat Multilingual Demo:** Switch to Tamil/Hindi/Telugu via Sarvam AI, displaying regional discharge instructions for village caregivers.

---

*CareLink PRD v4.0 — Engineered for Bharat Agentic 2026 by Nishant Maurya.*
