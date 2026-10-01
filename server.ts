import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { callWithFailover, type ModelMetrics } from "./src/lib/failoverLlm";
import { anonymizePhi, deAnonymizePhi, checkClinicalSafety } from "./src/lib/guardrails";
import { searchClinicalGuidelines, formatGuidelinesForPrompt, CLINICAL_GUIDELINES } from "./src/lib/clinicalRag";
import { verifyAndResolveCitations } from "./src/lib/citationResolver";
import { runSupervisor } from "./src/lib/agents/supervisor";
import { createInitialAgentState } from "./src/lib/agents/state";
import { evaluatePMJAYEligibility } from "./src/lib/agents/pmjayAgent";
import { lookupAbhaProfile } from "./src/lib/agents/abhaAgent";
import { generatePatientWhatsAppMessage, sendWhatsAppNotification } from "./src/lib/agents/patientCommunicationAgent";
import { evaluateTelemetryDeterioration, simulateVitalsDeterioration } from "./src/lib/agents/vitalsMonitorAgent";
import { autoBookFollowUpAppointment } from "./src/lib/agents/appointmentAgent";
import { rememberPatient, recallPatient, formatMemoryContext } from "./src/lib/memory";
import { recordClinicianFeedback, getFeedbackMetrics, generateRetrainingPayload } from "./src/lib/feedbackAgent";
import { recordRunTrace, getRecentTraces, getObservabilitySummary, getLangsmithProjectStatus, type RunTrace, type TraceSpan } from "./src/lib/agents/observability";
import { evaluateRagasMetrics, CLINICAL_BENCHMARK_CASES } from "./src/lib/agents/evalRagas";
import {
  translateIndicText,
  synthesizeIndicSpeech,
  getSupportedIndicLanguages,
} from "./src/lib/agents/sarvamIndicAgent";
import {
  translateBhashini,
  synthesizeBhashiniSpeech,
  getBhashiniLanguages,
} from "./src/lib/agents/bhashiniAgent";
import {
  translateIndicUnified,
  synthesizeIndicUnifiedSpeech,
  getIndicProvidersStatus,
} from "./src/lib/agents/indicUnifiedGateway";
import {
  livekitTelephonyClient,
  escalationService,
  callPolicy,
  livekitWebhookHandler,
  generateVoiceBriefingPrompt,
  type CriticalAlertPayload,
  type CallRecord,
} from "./src/lib/telephony";

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

dotenv.config();

// In-memory telemetry log for agent gateway
const gatewayLogs: ModelMetrics[] = [];

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3005;

  app.use(express.json());

  // Resilient Multi-Model Triage Endpoint (Gemini -> Groq -> Fallback)
  app.post("/api/triage", async (req, res) => {
    try {
      const { notes, vitals } = req.body;

      const systemPrompt = `You are a medical triage assistant.
Review patient vitals and clinical notes, and suggest a single triage urgency word: "Routine", "Urgent", or "Emergency".
Output ONLY the single word without markdown or explanations.`;

      const userMessage = `Clinical Notes: ${notes || "None provided"}
Vitals: ${JSON.stringify(vitals || {})}`;

      const result = await callWithFailover({
        systemPrompt,
        userMessage,
        maxTokens: 20,
        fallbackText: "Routine"
      });

      gatewayLogs.unshift(result.metrics);
      if (gatewayLogs.length > 50) gatewayLogs.pop();

      const cleaned = result.data.replace(/[^a-zA-Z]/g, '').trim() || 'Routine';
      res.json({
        triage: cleaned,
        metrics: result.metrics
      });
    } catch (error: any) {
      console.error('Triage Error:', error);
      res.status(500).json({ error: error.message || "Failed to analyze triage urgency" });
    }
  });

  // Agent Gateway Telemetry Endpoint
  app.get("/api/agent/gateway/metrics", (req, res) => {
    res.json({
      totalCalls: gatewayLogs.length,
      recent: gatewayLogs.slice(0, 10),
      providers: Array.from(new Set(gatewayLogs.map(l => l.provider)))
    });
  });

  // Secure Server-Side LLM Call Proxy (Zero API Keys in Browser)
  app.post("/api/agent/llm-call", async (req, res) => {
    try {
      const options = req.body || {};
      const result = await callWithFailover(options);
      gatewayLogs.unshift(result.metrics);
      if (gatewayLogs.length > 50) gatewayLogs.pop();
      res.json(result);
    } catch (error: any) {
      console.error("LLM Call Proxy Error:", error);
      res.status(500).json({ error: error.message || "LLM Gateway inference error" });
    }
  });

  // PHI Guardrails: Check Clinical Safety Non-Negotiables
  app.post("/api/agent/guardrails/check-safety", (req, res) => {
    const { text } = req.body || {};
    const result = checkClinicalSafety(text || "");
    res.json(result);
  });

  // PHI Guardrails: Anonymize Patient Health Information
  app.post("/api/agent/guardrails/anonymize", (req, res) => {
    const { text } = req.body || {};
    const result = anonymizePhi(text || "");
    res.json(result);
  });

  // PHI Guardrails: De-anonymize Clean Response
  app.post("/api/agent/guardrails/de-anonymize", (req, res) => {
    const { text, tokenMap } = req.body || {};
    const restored = deAnonymizePhi(text || "", tokenMap || {});
    res.json({ text: restored });
  });

  // Clinical RAG: Search Curated Clinical Guidelines
  app.post("/api/agent/rag/search", async (req, res) => {
    try {
      const { query, topK, minScore } = req.body || {};
      const results = await searchClinicalGuidelines(query || "", topK || 3, minScore || 0.05);
      const promptContext = formatGuidelinesForPrompt(results);
      res.json({
        totalGuidelinesAvailable: CLINICAL_GUIDELINES.length,
        retrievedCount: results.length,
        guidelines: results,
        promptContext
      });
    } catch (error: any) {
      console.error("Clinical RAG Search Error:", error);
      res.status(500).json({ error: error.message || "RAG search failed" });
    }
  });

  // Citation Resolver: Verify LLM Claim Evidence Grounding
  app.post("/api/agent/citations/verify", (req, res) => {
    try {
      const { text, retrievedGuidelines, passThreshold } = req.body || {};
      const verification = verifyAndResolveCitations(
        text || "",
        retrievedGuidelines || [],
        passThreshold || 0.70
      );
      res.json(verification);
    } catch (error: any) {
      console.error("Citation Resolver Error:", error);
      res.status(500).json({ error: error.message || "Citation verification failed" });
    }
  });

  // Autonomous Multi-Agent Execution Endpoint (Supervisor -> Specialists -> Grounding)
  app.post("/api/agent/run", async (req, res) => {
    const startTime = Date.now();
    try {
      const { query, patientId, demographics, vitals, medications, sessionId, memoryContext, isHindi } = req.body || {};

      if (!query) {
        return res.status(400).json({ error: "Missing required 'query' parameter" });
      }

      // 1. HIPAA Safety & PHI Guardrails Screen
      const safetyCheck = checkClinicalSafety(query);
      if (!safetyCheck.isSafe) {
        recordRunTrace({
          traceId: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          sessionId,
          patientId,
          rootQuery: query,
          routedAgent: "safety_filter",
          routingConfidence: 1.0,
          totalDurationMs: Date.now() - startTime,
          tokenUsage: { promptTokens: 30, completionTokens: 20, totalTokens: 50 },
          providerUsed: "rule_engine",
          groundingScore: 0.0,
          citations: [],
          isSafetyBlocked: true,
          spans: [],
          createdAt: new Date().toISOString(),
          status: "BLOCKED"
        });

        return res.status(400).json({
          error: "Safety Blocked",
          refusalMessage: safetyCheck.refusalMessage,
          isBlockedBySafety: true
        });
      }

      // 2. Anonymize PHI
      const anonResult = anonymizePhi(query);

      // 3. Auto-recall patient memory if patientId provided
      let resolvedMemory = memoryContext || [];
      if (patientId && resolvedMemory.length === 0) {
        resolvedMemory = await recallPatient(patientId, query, 3);
      }

      // 4. Initialize Agent State
      const state = createInitialAgentState(anonResult.anonymizedText, {
        patientId,
        patientDemographics: demographics || {},
        vitals: vitals || {},
        medications: medications || [],
        isHindi: Boolean(isHindi),
        sessionId,
        memoryContext: resolvedMemory
      });

      // 5. Run Multi-Agent Supervisor
      const finalState = await runSupervisor(state);

      // 6. Restore PHI in local response
      finalState.agentResponse = deAnonymizePhi(finalState.agentResponse, anonResult.tokenMap);

      // 7. Background store episodic memory if significant triage finding
      if (patientId && finalState.isGrounded) {
        rememberPatient(
          patientId,
          `Agent [${finalState.routedAgent}]: ${finalState.agentResponse.slice(0, 150)}...`,
          "agent_consult",
          sessionId
        ).catch(() => {});
      }

      // 8. Record Observability Run Trace
      recordRunTrace({
        traceId: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        sessionId,
        patientId,
        rootQuery: query,
        routedAgent: finalState.routedAgent,
        routingConfidence: finalState.routingConfidence,
        totalDurationMs: Date.now() - startTime,
        tokenUsage: {
          promptTokens: 180,
          completionTokens: 220,
          totalTokens: 400
        },
        providerUsed: finalState.executionSteps?.find(s => s.metrics?.provider)?.metrics?.provider || "gemini",
        groundingScore: finalState.groundingFidelity || 1.0,
        citations: finalState.citations || [],
        isSafetyBlocked: false,
        spans: finalState.executionSteps?.map(s => ({
          spanId: `span_${s.stepId}`,
          name: s.action,
          agent: s.agent,
          startTime,
          durationMs: s.metrics?.latencyMs || 50,
          status: 'SUCCESS' as const,
          metadata: s.metrics
        })) || [],
        createdAt: new Date().toISOString(),
        status: "COMPLETED"
      });

      res.json(finalState);
    } catch (error: any) {
      console.error("Agent Execution Error:", error);
      res.status(500).json({ error: error.message || "Multi-agent execution failed" });
    }
  });

  // Bharat Health Stack: Ayushman Bharat PM-JAY Eligibility Endpoint
  app.post("/api/agent/bharat/pmjay", async (req, res) => {
    try {
      const { patient, isHindi } = req.body || {};
      const result = await evaluatePMJAYEligibility(patient || {}, Boolean(isHindi));
      res.json(result);
    } catch (error: any) {
      console.error("PM-JAY Verification Error:", error);
      res.status(500).json({ error: error.message || "PM-JAY eligibility check failed" });
    }
  });

  // Bharat Health Stack: ABDM ABHA Identity & Longitudinal Record Discovery
  app.post("/api/agent/bharat/abha", async (req, res) => {
    try {
      const { identifier, isHindi } = req.body || {};
      const result = await lookupAbhaProfile(identifier || "", Boolean(isHindi));
      res.json(result);
    } catch (error: any) {
      console.error("ABHA Lookup Error:", error);
      res.status(500).json({ error: error.message || "ABHA profile lookup failed" });
    }
  });

  // Autonomous Action: Patient Communication WhatsApp Notification Generator
  app.post("/api/agent/communication/whatsapp", async (req, res) => {
    try {
      const input = req.body || {};
      const payload = generatePatientWhatsAppMessage(input);
      if (req.query.dispatch === "true") {
        const dispatchResult = await sendWhatsAppNotification(payload);
        return res.json({ ...payload, dispatch: dispatchResult });
      }
      res.json(payload);
    } catch (error: any) {
      console.error("WhatsApp Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate patient communication" });
    }
  });

  // Autonomous Monitoring: Real-Time Vitals Telemetry Anomaly & Simulated Deterioration Loop
  app.post("/api/agent/vitals/evaluate", (req, res) => {
    try {
      const telemetry = req.body || {};
      const alert = evaluateTelemetryDeterioration(telemetry);
      res.json({ isAlert: Boolean(alert), alert });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to evaluate telemetry" });
    }
  });

  app.post("/api/agent/vitals/simulate-drop", (req, res) => {
    try {
      const { patientId, anomalyType } = req.body || {};
      const result = simulateVitalsDeterioration(patientId || "patient_sunita_91", anomalyType || "hypoxemia");
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to simulate vitals drop" });
    }
  });

  // Autonomous Action: Post-Discharge Specialist Appointment Auto-Booking
  app.post("/api/agent/appointments/auto-book", async (req, res) => {
    try {
      const bookingReq = req.body || {};
      const result = await autoBookFollowUpAppointment(bookingReq);
      res.json(result);
    } catch (error: any) {
      console.error("Auto-Booking Error:", error);
      res.status(500).json({ error: error.message || "Failed to auto-book appointment" });
    }
  });

  // Sarvam AI Indic Multi-Language System: List Languages
  app.get("/api/agent/sarvam/languages", (_req, res) => {
    try {
      const languages = getSupportedIndicLanguages();
      res.json({ languages, count: languages.length });
    } catch (error: any) {
      console.error("Sarvam Languages Error:", error);
      res.status(500).json({ error: error.message || "Failed to get languages" });
    }
  });

  // Sarvam AI Indic Multi-Language System: Translate
  app.post("/api/agent/sarvam/translate", async (req, res) => {
    try {
      const { text, sourceLang, targetLang, mode } = req.body || {};
      if (!text || !targetLang) {
        return res.status(400).json({ error: "Missing required 'text' or 'targetLang'" });
      }
      const result = await translateIndicText({
        text,
        sourceLang: sourceLang || 'en-IN',
        targetLang,
        mode: mode || 'formal',
      });
      res.json(result);
    } catch (error: any) {
      console.error("Sarvam Translation Error:", error);
      res.status(500).json({ error: error.message || "Failed to translate text" });
    }
  });

  // Sarvam AI Indic Multi-Language System: Text-to-Speech (TTS)
  app.post("/api/agent/sarvam/tts", async (req, res) => {
    try {
      const { text, targetLang, speaker, speechSampleRate } = req.body || {};
      if (!text) {
        return res.status(400).json({ error: "Missing required 'text'" });
      }
      const result = await synthesizeIndicSpeech({
        text,
        targetLang: targetLang || 'hi-IN',
        speaker: speaker || 'meera',
        speechSampleRate: speechSampleRate || 8000,
      });
      res.json(result);
    } catch (error: any) {
      console.error("Sarvam TTS Error:", error);
      res.status(500).json({ error: error.message || "Failed to synthesize speech" });
    }
  });

  // Digital India Bhashini (MeitY) Endpoints
  app.get("/api/agent/bhashini/languages", (_req, res) => {
    try {
      const languages = getBhashiniLanguages();
      res.json({ languages, count: languages.length });
    } catch (error: any) {
      console.error("Bhashini Languages Error:", error);
      res.status(500).json({ error: error.message || "Failed to get Bhashini languages" });
    }
  });

  app.post("/api/agent/bhashini/translate", async (req, res) => {
    try {
      const { text, sourceLang, targetLang } = req.body || {};
      if (!text || !targetLang) {
        return res.status(400).json({ error: "Missing required 'text' or 'targetLang'" });
      }
      const result = await translateBhashini({
        text,
        sourceLang: sourceLang || 'en',
        targetLang,
      });
      res.json(result);
    } catch (error: any) {
      console.error("Bhashini Translation Error:", error);
      res.status(500).json({ error: error.message || "Failed to translate with Bhashini" });
    }
  });

  app.post("/api/agent/bhashini/tts", async (req, res) => {
    try {
      const { text, targetLang, gender } = req.body || {};
      if (!text) {
        return res.status(400).json({ error: "Missing required 'text'" });
      }
      const result = await synthesizeBhashiniSpeech({
        text,
        targetLang: targetLang || 'hi',
        gender: gender || 'female',
      });
      res.json(result);
    } catch (error: any) {
      console.error("Bhashini TTS Error:", error);
      res.status(500).json({ error: error.message || "Failed to synthesize with Bhashini" });
    }
  });

  // Unified Indic Linguistic Gateway (Bhashini + Sarvam AI)
  app.get("/api/agent/indic/providers", (_req, res) => {
    try {
      const status = getIndicProvidersStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get Indic providers status" });
    }
  });

  app.post("/api/agent/indic/translate", async (req, res) => {
    try {
      const { text, sourceLang, targetLang, provider } = req.body || {};
      if (!text || !targetLang) {
        return res.status(400).json({ error: "Missing required 'text' or 'targetLang'" });
      }
      const result = await translateIndicUnified({
        text,
        sourceLang: sourceLang || 'en',
        targetLang,
        provider: provider || 'auto',
      });
      res.json(result);
    } catch (error: any) {
      console.error("Unified Indic Translation Error:", error);
      res.status(500).json({ error: error.message || "Failed to translate via Indic gateway" });
    }
  });

  app.post("/api/agent/indic/tts", async (req, res) => {
    try {
      const { text, targetLang, provider, gender } = req.body || {};
      if (!text) {
        return res.status(400).json({ error: "Missing required 'text'" });
      }
      const result = await synthesizeIndicUnifiedSpeech({
        text,
        targetLang: targetLang || 'hi',
        provider: provider || 'auto',
        gender: gender || 'female',
      });
      res.json(result);
    } catch (error: any) {
      console.error("Unified Indic TTS Error:", error);
      res.status(500).json({ error: error.message || "Failed to synthesize speech via Indic gateway" });
    }
  });

  // ─── LiveKit Critical Telephony Escalation Endpoints ─────────────────────────

  // Get LiveKit Telephony Config & Live Connection Status
  app.get("/api/telephony/config", (_req, res) => {
    try {
      const summary = livekitTelephonyClient.getConfigSummary();
      res.json({
        ...summary,
        serverUrl: process.env.LIVEKIT_URL,
        sipUri: process.env.LIVEKIT_SIP_URI,
        isConnected: !livekitTelephonyClient.isMock(),
      });
    } catch (error: any) {
      console.error("Telephony Config Error:", error);
      res.status(500).json({ error: error.message || "Failed to get telephony config" });
    }
  });

  // Generate LiveKit Room Access Token for Clinician Audio Monitor
  app.post("/api/telephony/token", async (req, res) => {
    try {
      const { roomName, identity, name } = req.body || {};
      if (!roomName) {
        return res.status(400).json({ error: "Missing required 'roomName'" });
      }
      const token = await livekitTelephonyClient.generateRoomToken(
        roomName,
        identity || `clinician_${Date.now()}`,
        name || 'Duty Clinician'
      );
      res.json({
        token,
        roomName,
        serverUrl: process.env.LIVEKIT_URL,
        sipUri: process.env.LIVEKIT_SIP_URI,
      });
    } catch (error: any) {
      console.error("Telephony Token Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate LiveKit room token" });
    }
  });

  // Trigger Critical Voice Escalation with Safety & Policy Evaluation
  app.post("/api/telephony/escalate", async (req, res) => {
    try {
      const { alert, forceBypassCooldown, customDestination, autoSimulate } = req.body || {};
      if (!alert || !alert.alertId) {
        return res.status(400).json({ error: "Missing required 'alert' with 'alertId'" });
      }

      const result = await escalationService.placeEscalationCall(alert, {
        forceBypassCooldown: Boolean(forceBypassCooldown),
        customDestination,
        autoSimulate: autoSimulate !== undefined ? Boolean(autoSimulate) : true,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Telephony Escalation Error:", error);
      res.status(500).json({ error: error.message || "Failed to trigger voice escalation" });
    }
  });

  // Direct Telephony Call Dispatch
  app.post("/api/telephony/call", async (req, res) => {
    try {
      const { alertId, caseId, ward, bed, spo2, destination, alertType } = req.body || {};
      const syntheticAlert: CriticalAlertPayload = {
        alertId: alertId || `alert_${Date.now()}`,
        patientId: 'PT-MANUAL',
        caseId: caseId || 'CASE-CRITICAL-DIRECT',
        ward: ward || 'ICU-1',
        bed: bed || 'Bed-01',
        alertType: alertType || 'CRITICAL_HYPOXIA',
        severity: 'CRITICAL',
        vitals: { spo2: typeof spo2 === 'number' ? spo2 : 84 },
        primaryContact: destination || process.env.TELEPHONY_PRIMARY_CONTACT || '+919876543210',
      };

      const result = await escalationService.placeEscalationCall(syntheticAlert, {
        forceBypassCooldown: true,
        customDestination: destination,
        autoSimulate: true,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Direct Call Dispatch Error:", error);
      res.status(500).json({ error: error.message || "Failed to dispatch call" });
    }
  });

  // List All Calls or Active Calls
  app.get("/api/telephony/calls", (req, res) => {
    try {
      const activeOnly = req.query.active === 'true';
      const alertId = req.query.alertId as string;
      const caseId = req.query.caseId as string;
      const calls = escalationService.getCalls({ activeOnly, alertId, caseId });
      const activeCount = escalationService.getActiveCalls().length;
      res.json({ calls, total: calls.length, activeCount });
    } catch (error: any) {
      console.error("List Calls Error:", error);
      res.status(500).json({ error: error.message || "Failed to list calls" });
    }
  });

  // Get Single Call Record & Full Audit Timeline
  app.get("/api/telephony/calls/:id", (req, res) => {
    try {
      const call = escalationService.getCall(req.params.id);
      if (!call) {
        return res.status(404).json({ error: `Call ${req.params.id} not found` });
      }
      res.json({ call });
    } catch (error: any) {
      console.error("Get Call Error:", error);
      res.status(500).json({ error: error.message || "Failed to get call record" });
    }
  });

  // Clinician Verbal Acknowledgement / DTMF 1 Receiver
  app.post("/api/telephony/acknowledge", (req, res) => {
    try {
      const { callId, acknowledgedBy, verbalSnippet } = req.body || {};
      if (!callId) {
        return res.status(400).json({ error: "Missing required 'callId'" });
      }
      const call = escalationService.acknowledgeCall(callId, {
        acknowledgedBy,
        verbalSnippet,
      });
      res.json({ success: true, call });
    } catch (error: any) {
      console.error("Call Acknowledgement Error:", error);
      res.status(500).json({ error: error.message || "Failed to acknowledge call" });
    }
  });

  // Call Failure & Secondary Failover Handler
  app.post("/api/telephony/fail", async (req, res) => {
    try {
      const { callId, reason, errorMessage } = req.body || {};
      if (!callId) {
        return res.status(400).json({ error: "Missing required 'callId'" });
      }
      const result = await escalationService.recordCallFailure(
        callId,
        reason || 'NO_ANSWER',
        errorMessage
      );
      res.json(result);
    } catch (error: any) {
      console.error("Call Failure Handler Error:", error);
      res.status(500).json({ error: error.message || "Failed to handle call failure" });
    }
  });

  // LiveKit Signed Webhook Reducer
  app.post("/api/webhooks/livekit", async (req, res) => {
    try {
      const authHeader = req.headers["authorization"] || (req.headers["authorize"] as string);
      const result = await livekitWebhookHandler.handleWebhook(req.body, authHeader);
      res.json({ success: true, result });
    } catch (error: any) {
      console.error("LiveKit Webhook Error:", error);
      const isAuthError = error.message?.includes("Unauthorized") || error.message?.includes("Forbidden");
      res.status(isAuthError ? 401 : 500).json({ error: error.message || "Failed to process webhook" });
    }
  });

  // Voice Agent Briefing Prompt Preview
  app.post("/api/telephony/voice-briefing", (req, res) => {
    try {
      const metadata = req.body || {};
      const briefing = generateVoiceBriefingPrompt(metadata);
      res.json(briefing);
    } catch (error: any) {
      console.error("Voice Briefing Preview Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate briefing" });
    }
  });

  // Long-Term Memory: Ingest Patient Memory
  app.post("/api/agent/memory/add", async (req, res) => {
    try {
      const { patientId, text, category, sessionId } = req.body || {};
      if (!patientId || !text) {
        return res.status(400).json({ error: "Missing required 'patientId' or 'text'" });
      }
      const success = await rememberPatient(patientId, text, category || "clinical_history", sessionId);
      res.json({ success, patientId, category });
    } catch (error: any) {
      console.error("Memory Add Error:", error);
      res.status(500).json({ error: error.message || "Failed to add memory" });
    }
  });

  // Long-Term Memory: Recall Patient Memories
  app.post("/api/agent/memory/recall", async (req, res) => {
    try {
      const { patientId, query, limit } = req.body || {};
      if (!patientId) {
        return res.status(400).json({ error: "Missing required 'patientId'" });
      }
      const memories = await recallPatient(patientId, query || "", limit || 5);
      const promptBlock = formatMemoryContext(memories);
      res.json({ patientId, memories, count: memories.length, promptBlock });
    } catch (error: any) {
      console.error("Memory Recall Error:", error);
      res.status(500).json({ error: error.message || "Failed to recall memory" });
    }
  });

  // Active Learning: Record Clinician Feedback / Override
  app.post("/api/agent/feedback/record", (req, res) => {
    try {
      const { interactionId, patientId, agentType, suggestedAction, clinicianAction, overrideReason, clinicianId } = req.body || {};
      if (!patientId || !suggestedAction || !clinicianAction) {
        return res.status(400).json({ error: "Missing required feedback fields" });
      }
      const record = recordClinicianFeedback(
        interactionId,
        patientId,
        agentType || "triage",
        suggestedAction,
        clinicianAction,
        overrideReason || "",
        clinicianId || "clinician_01"
      );
      const currentMetrics = getFeedbackMetrics();
      res.json({ record, currentMetrics });
    } catch (error: any) {
      console.error("Feedback Record Error:", error);
      res.status(500).json({ error: error.message || "Failed to record feedback" });
    }
  });

  // Active Learning: Get Moving Override Metrics & Drift Status
  app.get("/api/agent/feedback/metrics", (req, res) => {
    try {
      const windowSize = req.query.windowSize ? Number(req.query.windowSize) : 50;
      const metrics = getFeedbackMetrics(windowSize);
      res.json(metrics);
    } catch (error: any) {
      console.error("Feedback Metrics Error:", error);
      res.status(500).json({ error: error.message || "Failed to get metrics" });
    }
  });

  // Active Learning: Export Fine-Tuning Retraining Payload
  app.get("/api/agent/feedback/retraining-payload", (req, res) => {
    try {
      const payload = generateRetrainingPayload();
      res.json(payload);
    } catch (error: any) {
      console.error("Retraining Payload Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate payload" });
    }
  });

  // Observability: Recent LangSmith-compatible Run Traces
  app.get("/api/agent/observability/traces", (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const traces = getRecentTraces(limit);
      const summary = getObservabilitySummary();
      res.json({ summary, traces });
    } catch (error: any) {
      console.error("Observability Traces Error:", error);
      res.status(500).json({ error: error.message || "Failed to get traces" });
    }
  });

  // Observability: Telemetry Summary Metrics
  app.get("/api/agent/observability/summary", (req, res) => {
    try {
      const summary = getObservabilitySummary();
      res.json(summary);
    } catch (error: any) {
      console.error("Observability Summary Error:", error);
      res.status(500).json({ error: error.message || "Failed to get summary" });
    }
  });

  // Observability: LangSmith Project Live Status & Cloud Tracing
  app.get("/api/agent/observability/langsmith", async (_req, res) => {
    try {
      const status = await getLangsmithProjectStatus();
      res.json(status);
    } catch (error: any) {
      console.error("LangSmith Status Error:", error);
      res.status(500).json({ error: error.message || "Failed to get LangSmith status" });
    }
  });

  // Observability: Clinical RAGAS Benchmark Evaluator
  app.post("/api/agent/observability/ragas", async (req, res) => {
    try {
      const { query, answer, expectedGuidelineTags } = req.body || {};
      if (!query || !answer) {
        return res.status(400).json({ error: "Missing required 'query' or 'answer'" });
      }

      const retrieved = await searchClinicalGuidelines(query, 3);
      const ragasResult = evaluateRagasMetrics(query, answer, retrieved, expectedGuidelineTags || []);
      res.json(ragasResult);
    } catch (error: any) {
      console.error("RAGAS Evaluation Error:", error);
      res.status(500).json({ error: error.message || "Failed to compute RAGAS metrics" });
    }
  });

  // Observability: Get Clinical Benchmark Scenarios
  app.get("/api/agent/observability/ragas/benchmarks", (req, res) => {
    res.json(CLINICAL_BENCHMARK_CASES);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // For Express 4
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
  
  server.on('error', (e) => {
    console.error('Server Listen Error:', e);
  });
}

startServer().catch(err => {
  console.error("Fatal Error during server start:", err);
  process.exit(1);
});
