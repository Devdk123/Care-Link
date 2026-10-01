# 🎙️ CareLink Telephony & LiveKit Closed-Loop Escalation Architecture

> **Bharat Agentic 2026 Hackathon** — Critical Voice Escalation Specification  
> **Author:** Nishant Maurya ([nishantma05@gmail.com](mailto:nishantma05@gmail.com))  
> **SDK:** `livekit-server-sdk` v2.16.1 | **Speech/Translation:** Digital India Bhashini (MeitY / NLTM) ⚡ Sarvam AI Indic API (`mayura:v1`, `bulbul:v1`)

---

## 🎯 Executive Overview

CareLink implements a production-grade, zero-delay **Closed-Loop Critical Voice Escalation Layer**. When acute clinical deterioration occurs (e.g., patient $\text{SpO}_2 \le 88\%$, lethal DDI, or sudden decompensation), traditional alerts (SMS, push notifications, EHR banners) suffer from alert fatigue and median acknowledgement delays of 14–45 minutes.

CareLink solves this by autonomously placing an outbound telephony call via **LiveKit SIP Outbound Trunking** directly to the on-call physician's mobile phone, briefing them in natural spoken language (English or 22 scheduled Indian languages via **Digital India Bhashini** & **Sarvam AI**), and listening for verbal acknowledgement (*"I'm on it"* or DTMF 1) to definitively close the loop in under 20 seconds.

```
       ┌───────────────────────────────┐
       │   Acute Telemetry Anomaly     │
       │   SpO2 <= 88%, HR: 118 bpm    │
       └───────────────┬───────────────┘
                       │
                       ▼
       ┌───────────────────────────────┐
       │     Call Policy Engine        │
       │ • Critical Severity Gate      │
       │ • Active Call Idempotency     │
       │ • 300s Cooldown Window        │
       │ • Max Attempts Ladder (2 max) │
       └───────────────┬───────────────┘
                       │ Eligible
                       ▼
       ┌───────────────────────────────┐
       │   LiveKit Telephony Adapter   │
       │ Room: carelink-alert-{alertId}│
       └───────┬───────────────┬───────┘
               │               │
      Dispatch │               │ Dial SIP Trunk
               ▼               ▼
 ┌───────────────────────┐   ┌────────────────────────┐
 │ LiveKit Voice Agent   │   │ Outbound SIP Trunk     │
 │ • Briefing < 25s      │   │ • Rings Clinician Phone│
 │ • Zero PHI Leaks      │   └───────────┬────────────┘
 │ • Zero Hallucinations │               │
 └───────────┬───────────┘               │ Answers
             │                           ▼
             │         WebRTC Stream ┌────────────────────────┐
             └──────────────────────►│ Clinician Mobile Phone │
                                     │ Speaks: "Acknowledge"  │
                                     └───────────┬────────────┘
                                                 │
                                                 ▼
                                     ┌────────────────────────┐
                                     │  LiveKit Webhook / Ack │
                                     │  • State: ACKNOWLEDGED │
                                     │  • Timeline Logged     │
                                     └────────────────────────┘
```

---

## 🔒 Clinical Safety & Voice Privacy Guardrails

1. **Minimum Necessary Data (Zero PHI Over Signaling):**
   - Telephony metadata strips all direct patient identifiers (full names, MRNs, dates of birth, home addresses).
   - Telephony signaling transmits **only** synthetic operational tokens:
     - Case ID (e.g. `CASE-9042`)
     - Ward & Bed (e.g. `ICU-2`, `Bed-04`)
     - Immediate Physiological Facts (e.g. `SpO2 83%`, `Heart Rate 118 bpm`)

2. **Zero Hallucination / No Oral Prescriptions:**
   - The voice agent is strictly restricted to reading server-verified clinical telemetry.
   - It is prohibited from diagnosing new conditions, prescribing medications, or modifying drug dosages over the voice channel.

3. **Identification & Strict Brevity Constraint:**
   - Every outbound call begins: *"This is CareLink automated clinical escalation. Critical alert for case {caseId} at {ward}, {bed}..."*
   - Script length is strictly constrained to **< 35 words** to ensure delivery completes in **$\le 25$ seconds**.

4. **Conversational Affirmation & DTMF 1:**
   - Recognizes natural spoken responses: *"Acknowledge"*, *"I'm on it"*, *"I am handling it"*, *"Attending bed now"*, *"Noted"*, and DTMF `1`.
   - Recognizes regional Indic affirmations: *"स्वीकार किया"* (Hindi), *"ஏற்றுக்கொண்டேன்"* (Tamil), *"అంగీకరించబడింది"* (Telugu).

---

## 🇮🇳 Sarvam AI Indic Multi-Language System

CareLink integrates Sarvam AI to provide native voice synthesis and translation across **10 Indian languages**:

| Language Code | Language | Native Script | Sarvam Translation Model | Sarvam TTS Voice |
|---|---|---|---|---|
| `hi-IN` | Hindi | हिन्दी (Devanagari) | `mayura:v1` | `meera` / `arvind` |
| `ta-IN` | Tamil | தமிழ் (Tamil) | `mayura:v1` | `pavithra` |
| `te-IN` | Telugu | తెలుగు (Telugu) | `mayura:v1` | `amartya` |
| `bn-IN` | Bengali | বাংলা (Bengali) | `mayura:v1` | `meera` |
| `kn-IN` | Kannada | ಕನ್ನಡ (Kannada) | `mayura:v1` | `amartya` |
| `mr-IN` | Marathi | मराठी (Devanagari) | `mayura:v1` | `meera` |
| `gu-IN` | Gujarati | ગુજરાતી (Gujarati) | `mayura:v1` | `arvind` |
| `ml-IN` | Malayalam | മലയാളം (Malayalam) | `mayura:v1` | `pavithra` |
| `od-IN` | Odia | ଓଡ଼ିଆ (Odia) | `mayura:v1` | `meera` |
| `pa-IN` | Punjabi | ਪੰਜਾਬੀ (Gurmukhi) | `mayura:v1` | `arvind` |
| `en-IN` | English (India) | English (Latin) | Direct | `meera` |

**Resilient Dual-Tier Fallback:**
When running without `SARVAM_API_KEY` (in offline hackathon testing or demo sandboxes), CareLink falls back automatically to:
1. **Deterministic Clinical Indic Vocabulary:** Validated clinical translations for hypoxia warnings, post-discharge care plans, and medication reminders.
2. **Dual-Model LLM Gateway:** Gemini 2.5 Flash ⚡ Groq Cloud Indic translation.
3. **Valid 16-Bit Mono PCM WAV Generator:** Generates playable RIFF audio chunks (`data:audio/wav;base64,UklGR...`) so UI audio players never crash.

---

## 📞 Telephony State Machine & Audit Timeline

```
[QUEUED] ──► [INITIATED] ──► [RINGING] ──► [IN_PROGRESS] ──► [ACKNOWLEDGED]
    │             │              │               │
    ▼             ▼              ▼               ▼
 [FAILED]     [FAILED]      [NO_ANSWER]       [NO_ANSWER]
                                 │
                                 ▼ (Attempt 1 Fails)
                    [RETRY SECONDARY CONTACT]
                                 │
                                 ▼ (Attempt 2 Fails)
                       [ESCALATION_FAILED]
                   (Code Blue / Hospital Broadcast)
```

### Audit Timeline Events Logged
- `[00:00]` **Telemetry Trigger:** Acute anomaly detected ($\text{SpO}_2 \le 88\%$). Call queued.
- `[00:02]` **Agent Dispatched:** LiveKit Voice Agent assigned to room `carelink-alert-{alertId}`.
- `[00:05]` **SIP Dialing:** Outbound SIP trunk dials clinician telephone number.
- `[00:09]` **Doctor Answers:** Clinician mobile answers; WebRTC audio stream connects.
- `[00:18]` **Verbal Ack:** Doctor speaks *"Acknowledge, attending bed"*.
- `[00:20]` **Closed-Loop Resolved:** Call marked `ACKNOWLEDGED`, stopping retry ladder and saving EHR trace.

---

## 🛠️ API Reference Summary

- `POST /api/telephony/escalate` — Evaluates policy and triggers escalation call.
- `POST /api/telephony/call` — Direct test call dispatch.
- `GET /api/telephony/calls` — Lists all calls (filter `?active=true`).
- `GET /api/telephony/calls/:id` — Returns single call record and audit timeline.
- `POST /api/telephony/acknowledge` — Registers clinician verbal or DTMF confirmation.
- `POST /api/telephony/fail` — Handles call failure and triggers secondary retry ladder.
- `POST /api/webhooks/livekit` — Signed LiveKit webhook reducer.
- `POST /api/telephony/voice-briefing` — Previews factual voice briefing prompt.
- `POST /api/agent/sarvam/translate` — Translates medical alerts into 10 Indic languages.
- `POST /api/agent/sarvam/tts` — Synthesizes spoken audio in native Indic accents.
- `GET /api/agent/sarvam/languages` — Returns supported Indic language metadata.

---

*CareLink Telephony Architecture — Built for Bharat Agentic 2026 by Nishant Maurya.*
