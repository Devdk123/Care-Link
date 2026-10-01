# 🗄️ CareLink Database Design & Schema

> **Project:** CareLink — Autonomous Multi-Agent HealthTech Platform  
> **Event:** Bharat Agentic 2026 | AIKart 12-Hour Hackathon  
> **Database:** Supabase PostgreSQL + Row-Level Security (RLS)  
> **Vector DB:** Qdrant Cloud (`carelink_guidelines`)  
> **Last Updated:** 2026-09-29  
> **Author:** Nishant Maurya ([nishantma05@gmail.com](mailto:nishantma05@gmail.com))  

---

## 📌 1. Database Architecture & Compliance

CareLink's database is architected for strict HIPAA and Indian DPDP (Digital Personal Data Protection) compliance:
- **Relational Core:** Supabase PostgreSQL with encrypted connection strings and Row-Level Security (RLS) policies.
- **Vector Knowledge Base:** Qdrant Cloud hosting dense embeddings for 10 clinical guidelines (ICMR, AHA, WHO).
- **Audit Ledger:** Append-only `audit_log` tracking every clinician interaction, model failover, and active learning review.

---

## 🗺️ 2. Core Entity Relationship Diagram (ERD)

```
┌────────────────────────┐         ┌────────────────────────┐
│        PATIENTS        │         │       ADMISSIONS       │
├────────────────────────┤         ├────────────────────────┤
│ id (UUID, PK)          │◄──────  │ id (UUID, PK)          │
│ abha_id (VARCHAR)      │   1:N   │ patient_id (UUID, FK)  │
│ name_token (VARCHAR)   │         │ admission_date (TS)    │
│ age (INT)              │         │ discharge_date (TS)    │
│ gender (VARCHAR)       │         │ primary_diagnosis (TXT)│
│ risk_tier (VARCHAR)    │         │ length_of_stay (INT)   │
│ created_at (TIMESTAMP) │         └───────────┬────────────┘
└───────────┬────────────┘                     │
            │                                  │ 1:N
            │ 1:N                              ▼
            ▼                      ┌────────────────────────┐
┌────────────────────────┐         │     VITALS_RECORDS     │
│       CARE_PLANS       │         ├────────────────────────┤
├────────────────────────┤         │ id (UUID, PK)          │
│ id (UUID, PK)          │         │ admission_id (UUID, FK)│
│ patient_id (UUID, FK)  │         │ spo2 (FLOAT)           │
│ discharge_meds (JSONB) │         │ systolic_bp (INT)      │
│ follow_up_date (DATE)  │         │ diastolic_bp (INT)     │
│ lifestyle_diet (JSONB) │         │ weight_change_kg (FLT) │
│ red_flags (JSONB)      │         │ recorded_at (TIMESTAMP)│
│ created_at (TIMESTAMP) │         └────────────────────────┘
└────────────────────────┘
```

---

## 🔒 3. Audit Log Ledger (`audit_log`)

Every autonomous agent decision and clinician action is immutably recorded:

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id VARCHAR NOT NULL,
  event_type VARCHAR NOT NULL, -- 'TRIAGE_EXECUTION', 'DDI_BLOCK', 'CLINICIAN_OVERRIDE'
  routed_agent VARCHAR NOT NULL,
  citations TEXT[],
  grounding_fidelity FLOAT,
  model_provider VARCHAR NOT NULL, -- 'gemini', 'groq', 'fallback'
  latency_ms INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

---

*CareLink Database Design — Bharat Agentic 2026.*
