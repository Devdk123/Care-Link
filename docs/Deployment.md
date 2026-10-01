# 🚀 CareLink Deployment & Operations Guide

> **Project:** CareLink — Autonomous Multi-Agent HealthTech Platform  
> **Event:** Bharat Agentic 2026 | AIKart 12-Hour Hackathon  
> **Runtime:** Node.js 20.x + Express + Vite  
> **Last Updated:** 2026-09-29  
> **Lead:** Nishant Maurya ([nishantma05@gmail.com](mailto:nishantma05@gmail.com))  

---

## 🌍 1. Environments & Ports

| Service | Port | Tech Stack | Status |
|:---:|:---:|:---:|:---:|
| **CareLink Web Portal** | `3005` | Express + Vite SSR (React 19) | 🟢 Live |
| **Federated ML Node** | `8001` | FastAPI + Flower Framework | 🟢 Local / Simulated |
| **Qdrant Vector DB** | Cloud | Qdrant Cloud (AWS us-east-2) | 🟢 Connected |
| **Mem0 Memory API** | Cloud | Mem0 REST API + Local Mirror | 🟢 Connected |

---

## 🛠️ 2. Running Locally (Judge & Evaluator Setup)

```bash
# 1. Clone repository
git clone https://github.com/Niss54/Care-link.git
cd Care-link

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Fill in GEMINI_API_KEY and GROQ_API_KEY

# 4. Start local development server
npm run dev
# Server boots at http://localhost:3005
```

---

## 🐳 3. Production Build & Verification

```bash
# Lint check (TypeScript 0 errors)
npm run lint

# Production bundle build
npm run build:client

# Run full 9-layer E2E automated test suite
npx tsx scripts/test_phase6_e2e.ts
```

---

*CareLink Deployment Guide — Bharat Agentic 2026.*
