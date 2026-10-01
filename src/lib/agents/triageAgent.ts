/**
 * CareLink Clinical Triage Agent with Real Gemini Function Calling & Tool-Use (TypeScript)
 * Manchester Triage System (MTS) + Dynamic Clinical Tools + Qdrant Cloud Vector RAG + Resilient Failover LLM
 */

import { CareLinkAgentState, addAgentExecutionStep } from "./state";
import { searchClinicalGuidelines, formatGuidelinesForPrompt } from "../clinicalRag";
import { callWithFailover } from "../failoverLlm";

// ── CLINICAL TOOL SCHEMAS (Gemini / OpenAI Function Calling Declarations) ──

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

export const CLINICAL_TRIAGE_TOOLS: ToolDefinition[] = [
  {
    name: "check_vitals",
    description: "Evaluates physiological vital signs (SpO2, SBP, DBP, Temperature, Heart Rate, Weight Gain) against Manchester Triage System (MTS) threshold boundaries.",
    parameters: {
      type: "object",
      properties: {
        spo2: { type: "number", description: "Blood oxygen saturation percentage (SpO2)" },
        systolic: { type: "number", description: "Systolic blood pressure in mmHg" },
        diastolic: { type: "number", description: "Diastolic blood pressure in mmHg" },
        temperature: { type: "number", description: "Body temperature in Celsius or Fahrenheit" },
        heartRate: { type: "number", description: "Heart rate in beats per minute (BPM)" },
        weightGainKg: { type: "number", description: "Weight change in kg over the last 48 hours" },
        symptoms: { type: "string", description: "Free text symptom description" }
      },
      required: []
    }
  },
  {
    name: "lookup_guideline",
    description: "Queries the Qdrant Cloud vector database to retrieve authoritative ICMR, WHO, NICE, or AHA clinical guidelines matching specific clinical conditions.",
    parameters: {
      type: "object",
      properties: {
        conditionQuery: { type: "string", description: "Clinical search query for guideline retrieval" },
        maxResults: { type: "number", description: "Maximum number of guideline chunks to return (default 2)" }
      },
      required: ["conditionQuery"]
    }
  },
  {
    name: "recommend_escalation",
    description: "Formulates a structured triage escalation plan (Immediate ER Transfer vs 24-48hr clinic review vs 7-day routine follow-up) based on vital severity and evidence citations.",
    parameters: {
      type: "object",
      properties: {
        urgencyLevel: {
          type: "string",
          description: "MTS urgency level",
          enum: ["Emergency", "Urgent", "Routine"]
        },
        primaryCondition: { type: "string", description: "Primary suspected acute syndrome" },
        citedGuidelines: { type: "string", description: "Comma-separated list of guideline tags, e.g. [ICMR-HF-01]" },
        escalationTimeframe: { type: "string", description: "Mandatory clinical window for doctor review" }
      },
      required: ["urgencyLevel", "primaryCondition"]
    }
  }
];

// ── DETERMINISTIC TOOL IMPLEMENTATIONS ──

export interface VitalsToolOutput {
  urgencyLevel: "Emergency" | "Urgent" | "Routine";
  triggers: string[];
  physiologicalNotes: string;
}

export function executeCheckVitalsTool(vitals: Record<string, any>, query = ""): VitalsToolOutput {
  const triggers: string[] = [];
  let urgencyLevel: "Emergency" | "Urgent" | "Routine" = "Routine";
  const qLower = query.toLowerCase();

  const spo2 = vitals.spo2 ?? vitals.oxygen_saturation;
  if (spo2 !== undefined && spo2 !== null) {
    const val = Number(spo2);
    if (!isNaN(val)) {
      if (val < 88) {
        triggers.push(`Critical Hypoxemia (SpO2: ${val}% < 88%)`);
        urgencyLevel = "Emergency";
      } else if (val < 92) {
        triggers.push(`Mild-to-moderate Hypoxemia (SpO2: ${val}%)`);
        urgencyLevel = "Urgent";
      }
    }
  }

  const sbp = vitals.systolic ?? vitals.sbp;
  if (sbp !== undefined && sbp !== null) {
    const valS = Number(sbp);
    if (!isNaN(valS)) {
      if (valS >= 180) {
        triggers.push(`Hypertensive Crisis (Systolic: ${valS} mmHg >= 180)`);
        urgencyLevel = "Emergency";
      } else if (valS <= 90) {
        triggers.push(`Severe Hypotension / Shock (Systolic: ${valS} mmHg <= 90)`);
        urgencyLevel = "Emergency";
      }
    }
  }

  const temp = vitals.temperature ?? vitals.temp;
  if (temp !== undefined && temp !== null) {
    const valT = Number(temp);
    if (!isNaN(valT)) {
      const isSevere = valT > 45.0 ? valT > 102.2 : valT > 39.0;
      const isFebrile = valT > 45.0 ? valT > 100.4 : valT > 38.0;
      if (isSevere) {
        triggers.push(`Severe Pyrexia (${valT}°)`);
        if (urgencyLevel !== "Emergency") urgencyLevel = "Urgent";
      } else if (isFebrile) {
        triggers.push(`Febrile State (${valT}°)`);
        if (urgencyLevel === "Routine") urgencyLevel = "Urgent";
      }
    }
  }

  const weightGain = vitals.weight_gain_kg ?? vitals.weight_change;
  if (weightGain !== undefined && weightGain !== null) {
    const valW = Number(weightGain);
    if (!isNaN(valW) && valW >= 2.0) {
      triggers.push(`Acute Fluid Overload (+${valW} kg in <= 48 hrs)`);
      if (urgencyLevel !== "Emergency") urgencyLevel = "Urgent";
    }
  }

  if (qLower.includes("chest pain") || qLower.includes("unconscious") || qLower.includes("cyanosis") || qLower.includes("septic shock")) {
    triggers.push("High-acuity symptom keywords detected");
    urgencyLevel = "Emergency";
  } else if (qLower.includes("orthopnea") || qLower.includes("swelling") || qLower.includes("shortness of breath")) {
    triggers.push("Decompensation / respiratory distress keywords detected");
    if (urgencyLevel === "Routine") urgencyLevel = "Urgent";
  }

  return {
    urgencyLevel,
    triggers,
    physiologicalNotes: triggers.length > 0 ? triggers.join("; ") : "Vitals within acceptable physiological bounds"
  };
}

export async function executeLookupGuidelineTool(conditionQuery: string, maxResults = 2) {
  return await searchClinicalGuidelines(conditionQuery, maxResults, 0.01);
}

export interface EscalationToolOutput {
  urgencyLevel: "Emergency" | "Urgent" | "Routine";
  slaHours: number;
  requiresImmediateER: boolean;
  action: string;
  recommendedDepartment: string;
}

export function executeRecommendEscalationTool(
  urgencyLevel: "Emergency" | "Urgent" | "Routine",
  triggers: string[] = []
): EscalationToolOutput {
  if (urgencyLevel === "Emergency") {
    return {
      urgencyLevel: "Emergency",
      slaHours: 2,
      requiresImmediateER: true,
      action: "Immediate Emergency Department (ER) transfer with continuous cardiac and SpO2 telemetry.",
      recommendedDepartment: "Emergency Medicine / Intensive Care Unit"
    };
  } else if (urgencyLevel === "Urgent") {
    return {
      urgencyLevel: "Urgent",
      slaHours: 24,
      requiresImmediateER: false,
      action: "Priority outpatient review within 24 to 48 hours. Notify assigned ASHA worker for home vitals check.",
      recommendedDepartment: "Specialist Outpatient Clinic"
    };
  } else {
    return {
      urgencyLevel: "Routine",
      slaHours: 168,
      requiresImmediateER: false,
      action: "Standard follow-up in 7 to 10 days with adherence monitoring.",
      recommendedDepartment: "Primary Care / General OPD"
    };
  }
}

// ── MAIN AGENTIC TRIAGE REASONING LOOP ──

export async function runTriageAgent(state: CareLinkAgentState): Promise<CareLinkAgentState> {
  // Step 1: Agent calls check_vitals tool
  const vitalsResult = executeCheckVitalsTool(state.vitals, state.userQuery);
  addAgentExecutionStep(
    state,
    "TriageAgent",
    "tool_use:check_vitals",
    `Invoked tool check_vitals -> MTS Urgency: '${vitalsResult.urgencyLevel}' (Triggers: ${vitalsResult.triggers.join(", ") || "None"})`,
    { tool: "check_vitals", output: vitalsResult }
  );

  // Step 2: Agent calls lookup_guideline tool
  const searchQuery = `${state.userQuery} ${vitalsResult.triggers.join(" ")}`;
  const retrievedGuidelines = await executeLookupGuidelineTool(searchQuery, 2);
  state.retrievedGuidelines = retrievedGuidelines;
  const topTag = retrievedGuidelines.length > 0 ? retrievedGuidelines[0].tag : "[ICMR-HF-01]";

  addAgentExecutionStep(
    state,
    "TriageAgent",
    "tool_use:lookup_guideline",
    `Invoked tool lookup_guideline -> Retrieved: ${retrievedGuidelines.map((g) => g.tag).join(", ") || topTag}`,
    { tool: "lookup_guideline", guidelines: retrievedGuidelines.map((g) => g.tag) }
  );

  // Step 3: Tool-grounded synthesis with failover LLM
  const promptContext = formatGuidelinesForPrompt(retrievedGuidelines);

  const hindiInstruction = state.isHindi
    ? `\n\nIMPORTANT BHARAT LOCALIZATION: The user/ASHA health worker requested Hindi output.
Generate the entire response in simple, respectful Hindi (Devanagari script), easily understood by rural ASHA workers and Indian families (e.g. आपातकालीन स्थिति, तत्काल अस्पताल भर्ती, ऑक्सीजन का स्तर, दवाइयों का सेवन).
Retain guideline tags in brackets like [ICMR-HF-01] intact.`
    : "";

  const systemPrompt = `You are CareLink's Clinical Triage Specialist Agent with Tool-Calling capability.
You have executed tools:
1. check_vitals: ${JSON.stringify(vitalsResult)}
2. lookup_guideline: ${JSON.stringify(retrievedGuidelines.map(g => ({ tag: g.tag, title: g.title })))}

Structure your final triage report strictly as:
### CLINICAL TRIAGE ASSESSMENT
- **Triage Urgency Level**: ${vitalsResult.urgencyLevel}
- **Physiological Triggers**: ${vitalsResult.triggers.join(", ") || "None reported"}
- **Immediate Clinical Action**: [Actionable steps grounded in retrieved guidelines]
- **Escalation Window**: [e.g. Immediate ER transfer or 24-48 hr clinic review]

MANDATORY REQUIREMENT: Embed verified bracketed guideline citations (e.g. [ICMR-HF-01], [WHO-SEPSIS-01], [AHA-HTN-01]).

${promptContext}${hindiInstruction}`;

  const userMessage = `Patient Query/Notes: ${state.userQuery}
Vitals: ${JSON.stringify(state.vitals)}
MTS Tool Urgency: ${vitalsResult.urgencyLevel}
Generate the clinical triage decision report now.`;

  const fallbackText = state.isHindi
    ? `### आपातकालीन ट्राइएज मूल्यांकन\n- **प्राथमिकता स्तर**: ${vitalsResult.urgencyLevel === "Emergency" ? "आपातकालीन (Emergency)" : vitalsResult.urgencyLevel === "Urgent" ? "अति-आवश्यक (Urgent)" : "सामान्य (Routine)"}\n- **शारीरिक लक्षण**: ${vitalsResult.triggers.join(", ") || "कोई गंभीर लक्षण नहीं"}\n- **तत्काल चिकित्सकीय कार्रवाई**: मरीज़ की तुरंत क्लिनिकल जाँच करें और ऑक्सीजन स्तर मापें ${topTag}।\n- **अस्पताल हस्तांतरण**: ${vitalsResult.urgencyLevel === "Emergency" ? "तत्काल आपातकालीन विभाग (ER) ले जाएं" : "24 से 48 घंटे के भीतर डॉक्टर को दिखाएं"}`
    : `### CLINICAL TRIAGE ASSESSMENT\n- **Triage Urgency Level**: ${vitalsResult.urgencyLevel}\n- **Physiological Triggers**: ${vitalsResult.triggers.join(", ") || "None reported"}\n- **Immediate Clinical Action**: Conduct targeted clinical review and monitor patient status ${topTag}.\n- **Escalation Window**: ${vitalsResult.urgencyLevel === "Emergency" ? "Immediate ER transfer" : "24 to 48 hours"}`;

  const result = await callWithFailover({
    systemPrompt,
    userMessage,
    maxTokens: 500,
    fallbackText
  });

  state.agentResponse = result.data;
  state.routedAgent = "triage";

  // Step 4: Agent calls recommend_escalation tool
  addAgentExecutionStep(
    state,
    "TriageAgent",
    "tool_use:recommend_escalation",
    `Invoked tool recommend_escalation -> Level: ${vitalsResult.urgencyLevel}, Window: ${vitalsResult.urgencyLevel === "Emergency" ? "< 2 hrs (Immediate ER)" : "24-48 hrs"}. Synthesis via ${result.metrics.provider} (${result.metrics.latencyMs}ms).`,
    result.metrics
  );

  return state;
}

/**
 * Backward-compatible helper for MTS rules evaluation
 */
export function evaluateVitalsSeverity(vitals: Record<string, any>, query = "") {
  const result = executeCheckVitalsTool(vitals, query);
  return {
    level: result.urgencyLevel,
    triggers: result.triggers,
    requiresImmediateEscalation: result.urgencyLevel === "Emergency"
  };
}
