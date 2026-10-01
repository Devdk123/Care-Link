# 🎬 CareLink — 3-Minute Live Hackathon Pitch & Demo Script

> **Event:** Bharat Agentic 2026 | AIKart 12-Hour Autonomous Agent Hackathon  
> **Track:** Healthcare, MedTech & Clinical AI Agents  
> **Presenter:** Nishant Maurya ([nishantma05@gmail.com](mailto:nishantma05@gmail.com))  
> **Project:** CareLink — Autonomous Multi-Agent HealthTech Platform  
> **Live Demo Target:** `http://localhost:3005` (Agent Cockpit AI)  
> **Total Duration:** 3 Minutes Sharp (Judges Panel Pitch)  

---

## ⏱️ Pitch Timeline Overview

```
0:00 ─── Hook & The Healthcare Crisis (30s)
0:30 ─── Zero-PHI Guardrail & ABHA Lookup (30s)
1:00 ─── Autonomous Multi-Agent Execution & Failover (45s)
1:45 ─── Bharat Differentiator: Hindi ASHA Mode & PM-JAY (30s)
2:15 ─── Autonomy: WhatsApp Discharge & Vitals Alert Loop (30s)
2:45 ─── Active Learning Drift Alert & Winning Close (15s)
```

---

## 🎤 Scene 1 — The Hook & The Healthcare Crisis (0:00 – 0:30)

**[Visual: CareLink Clinical Dashboard showing 48 patients, 17 high-risk banner, and telemetry monitor]**

> **SAY:**
> *"Judges, every single day in hospitals across India, 6 out of every 100 patients discharged after a heart attack or acute surgery return to the emergency room within 30 days — suffering preventable complications and devastating financial toxicity.*
>
> *Overstretched clinical teams cannot monitor thousands of post-discharge variables manually. But conventional generative AI cannot be trusted at the bedside: it leaks patient health records, hallucinates lethal dosages, and crashes when API rate limits strike.*
>
> *Welcome to **CareLink** — the first autonomous 12-layer multi-agent healthcare platform engineered specifically for Bharat, guaranteeing zero PHI leakage, deterministic drug safety, and 100% evidence-grounded clinical decisions."*

---

## 🔒 Scene 2 — Zero-PHI Guardrail & ABHA Profile Lookup (0:30 – 1:00)

**[Action: Switch to Agent Cockpit AI (`/agent-cockpit`). Select Patient Sunita Sharma (72F, Post-MI CHF)]**

> **SAY:**
> *"Watch what happens before any AI model ever sees this clinical query:*
>
> *Our **Layer 1 HIPAA & Aadhaar PHI Scrubber** intercepts the input. In under 50 milliseconds, it tokenizes all names, hospital MRNs, phone numbers, and 12-digit Aadhaar numbers into synthetic tokens inside the local hospital firewall. Zero private health data ever leaves the premises.*
>
> *Simultaneously, our **ABHA Identity Agent** verifies the patient's Ayushman Bharat Digital Health profile, pulling linked chronic diagnoses seamlessly."*

---

## 🤖 Scene 3 — Autonomous Multi-Agent Execution & Failover (1:00 – 1:45)

**[Action: Click "Execute Clinical Agent Pipeline". Watch the StateGraph visualizer and step-by-step reasoning feed]**

> **SAY:**
> *"Now watch our multi-agent architecture in action:*
>
> *1. Our **LangGraph Supervisor Router** classifies clinical intent with 94% confidence, dispatching to our specialist **Triage Agent**.*
>
> *2. The Triage Agent autonomously executes tool calls: evaluating vitals under the Manchester Triage System — SpO2 89%, weight change +2.8 kg — flagging an acute pulmonary edema emergency!*
>
> *3. It queries **Qdrant Cloud** to retrieve peer-reviewed protocol `[ICMR-HF-01]`.*
>
> *4. If Gemini experiences quota limits during this spike, our **Dual-Model Gateway** automatically fails over to Groq in under 350 milliseconds.*
>
> *5. And our **Citation Resolver** verifies every sentence against retrieved guidelines, scoring a perfect Grounding Fidelity!"*

---

## 🇮🇳 Scene 4 — Bharat Differentiators: Hindi ASHA Mode & PM-JAY (1:45 – 2:15)

**[Action: Toggle Language Switcher to "Hindi (ASHA Worker Mode)". Show PM-JAY Eligibility Card]**

> **SAY:**
> *"Now for Bharat's reality:*
>
> *Over 600 million citizens in India do not speak English. With one click, CareLink activates **ASHA Worker Mode**, autonomously generating the post-discharge care plan in simple, clear Devanagari Hindi so community health workers and rural families understand exact dosage schedules.*
>
> *Simultaneously, our **PM-JAY Eligibility Agent** scans patient demographics and confirms: this patient is eligible for ₹5,00,000 Ayushman Bharat health insurance coverage, listing empanelled cardiac procedures!"*

---

## ⚡ Scene 5 — Autonomy: WhatsApp Discharge & Vitals Alert Loop (2:15 – 2:45)

**[Action: Show WhatsApp Message Preview with "Send to Patient" button. Trigger simulated vitals drop]**

> **SAY:**
> *"True agentic AI doesn't stop at giving advice — it takes autonomous action:*
>
> *Our **Patient Communication Agent** automatically formats a bilingual WhatsApp discharge summary with red-flag warning signs and medication reminders, ready for instant dispatch to the family's phone.*
>
> *Meanwhile, our **Vitals Monitor Agent** runs in the background. Watch: when telemetry simulates SpO2 dropping to 88%, an emergency alert triggers automatically across the clinical ward!"*

---

## 🎯 Scene 6 — Active Learning Drift Alert & Winning Close (2:45 – 3:00)

**[Action: Point to the Drift Monitor widget showing STABLE (0.0%). Freeze on the full 12-layer cockpit]**

> **SAY:**
> *"Finally, notice our **Clinician-in-the-Loop Feedback Engine**. When doctors approve or modify care plans, we track the rolling override rate. If it crosses 15%, an active drift alert triggers, automatically compiling datasets for federated retraining.*
>
> *CareLink is autonomous, grounded in evidence, privacy-first, and built for Bharat. We are not just building AI for doctors — we are building AI that saves lives. Thank you!"*

---

## ❓ Anticipated Judge Q&A Cheatsheet

### Q1: "How do you guarantee that patient health records aren't leaked to external LLMs?"
> *"Our Layer 1 PHI Guardrail sits completely in front of all model gateways. It uses deterministic Regex and NER tokenizer patterns to replace all PII, PHI, and Indian Aadhaar numbers with synthetic session tokens (e.g. `[PATIENT_001]`). Only sanitized text reaches Gemini or Groq. De-tokenization happens in-memory inside the hospital firewall only when rendering to authorized clinicians."*

### Q2: "What happens if Gemini hits a rate limit or goes down during an emergency triage?"
> *"CareLink implements a dual-model auto-failover gateway. If Gemini returns HTTP 429 (quota exhausted) or HTTP 503 within an 8-second timeout, the system instantaneously auto-switches to Groq Cloud running `llama-3.3-70b-versatile` or `openai/gpt-oss-120b` in under 400 milliseconds. If both providers fail, a deterministic clinical safety fallback activates with logged audit trails."*

### Q3: "How do you prevent dangerous hallucinations in medication prescriptions?"
> *"We use a two-pronged safety architecture: First, our Clinical RAG Engine retrieves authoritative ICMR, WHO, and AHA guidelines from Qdrant Cloud, and our Citation Resolver enforces bracketed citation tags with Grounding Fidelity scoring. Second, our Medication Safety Agent runs a deterministic pharmacovigilance blocker that intercepts and locks lethal drug combinations (like Warfarin + NSAIDs or Metformin with eGFR < 30) before the LLM can generate a response."*

### Q4: "What makes this specifically tailored for Bharat?"
> *"CareLink integrates three Bharat-native capabilities: (1) ABHA ID lookup connecting to Ayushman Bharat Digital Mission profiles, (2) PM-JAY Eligibility Checker identifying ₹5 Lakhs cashless treatment benefits, and (3) Bilingual Hindi output tailored for rural ASHA health workers who bridge the gap between tertiary hospitals and village homes."*
