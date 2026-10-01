/**
 * CareLink Multi-Agent Supervisor & StateGraph Orchestrator (TypeScript)
 * Routes clinical queries to specialist agents with confidence-floor fallback,
 * enforces secondary medication safety screens, and resolves evidence citations.
 */

import {
  CareLinkAgentState,
  CLINICAL_INTENTS,
  ClinicalIntent,
  DEFAULT_INTENT,
  CONFIDENCE_FLOOR,
  addAgentExecutionStep
} from "./state";
import { runTriageAgent } from "./triageAgent";
import { runRiskAnalystAgent } from "./riskAnalystAgent";
import { runCarePlanAgent } from "./carePlanAgent";
import { runMedicationSafetyAgent, checkDeterministicDdi } from "./medicationSafetyAgent";
import { evaluatePMJAYEligibility } from "./pmjayAgent";
import { lookupAbhaProfile } from "./abhaAgent";
import { verifyAndResolveCitations } from "../citationResolver";
import { callWithFailover } from "../failoverLlm";
import { traceable } from "langsmith/traceable";

async function _classifyClinicalIntent(
  query: string
): Promise<{ intent: ClinicalIntent; confidence: number }> {
  const qLower = query.toLowerCase();

  // Fast deterministic heuristics
  if (
    ["pmjay", "pm-jay", "ayushman", "coverage", "bpl", "insurance", "cashless", "5 lakh", "500000", "golden card"].some((k) =>
      qLower.includes(k)
    )
  ) {
    return { intent: "pmjay", confidence: 0.95 };
  }

  if (
    ["abha", "abdm", "health id", "aadhaar", "linked record", "longitudinal ehr", "ndhm"].some((k) =>
      qLower.includes(k)
    )
  ) {
    return { intent: "abha", confidence: 0.94 };
  }

  if (
    ["interaction", "contraindicat", "warfarin", "nsaid", "ibuprofen", "metformin", "drug safety", "side effect", "pill", "taking with"].some((k) =>
      qLower.includes(k)
    )
  ) {
    return { intent: "medication_safety", confidence: 0.95 };
  }

  if (
    ["readmission", "risk factor", "shap", "xgboost", "predict", "cohort", "why is risk high", "probability"].some((k) =>
      qLower.includes(k)
    )
  ) {
    return { intent: "risk_analyst", confidence: 0.92 };
  }

  if (
    ["care plan", "discharge plan", "diet", "lifestyle", "follow up schedule", "instructions after discharge", "self-monitoring", "recovery plan"].some((k) =>
      qLower.includes(k)
    )
  ) {
    return { intent: "care_plan", confidence: 0.90 };
  }

  if (
    ["triage", "emergency", "urgent", "vital", "spo2", "fever", "chest pain", "shortness of breath", "blood pressure", "orthopnea"].some((k) =>
      qLower.includes(k)
    )
  ) {
    return { intent: "triage", confidence: 0.92 };
  }

  // LLM classification
  try {
    const res = await callWithFailover({
      systemPrompt:
        "You are CareLink's Clinical Intent Classifier.\n" +
        "Classify the query into EXACTLY one of: ['triage', 'risk_analyst', 'care_plan', 'medication_safety'].\n" +
        "Output ONLY a JSON string: {\"intent\": \"<intent>\", \"confidence\": <float 0.0 to 1.0>}.",
      userMessage: `Query: ${query}`,
      maxTokens: 50,
      fallbackText: '{"intent": "triage", "confidence": 0.50}'
    });

    const parsed = JSON.parse(res.data.replace(/```json|```/g, "").trim());
    const intent = (parsed.intent || DEFAULT_INTENT).toLowerCase() as ClinicalIntent;
    const confidence = Number(parsed.confidence) || 0.50;

    if (CLINICAL_INTENTS.includes(intent)) {
      return { intent, confidence };
    }
  } catch {
    // Fallback silently
  }

  return { intent: DEFAULT_INTENT, confidence: 0.50 };
}

export const classifyClinicalIntent = traceable(_classifyClinicalIntent, {
  name: "Classify Clinical Intent",
  run_type: "chain"
});

export function routeAgent(intent: string, confidence: number): ClinicalIntent {
  if (CLINICAL_INTENTS.includes(intent as ClinicalIntent) && confidence >= CONFIDENCE_FLOOR) {
    return intent as ClinicalIntent;
  }
  return DEFAULT_INTENT;
}

async function _runSupervisor(state: CareLinkAgentState): Promise<CareLinkAgentState> {
  // ── STEP 1: Intent Classification ──
  const { intent, confidence } = await classifyClinicalIntent(state.userQuery);
  state.intent = intent;
  state.routingConfidence = confidence;

  const routedAgent = routeAgent(intent, confidence);
  state.routedAgent = routedAgent;

  addAgentExecutionStep(
    state,
    "Supervisor",
    "intent_classification",
    `Classified intent as '${intent}' (conf=${confidence}). Routed to '${routedAgent}'.`,
    { intent, confidence, routedAgent }
  );

  // ── STEP 2: Specialist Execution ──
  switch (routedAgent) {
    case "pmjay": {
      const pmjay = await evaluatePMJAYEligibility(
        {
          patientId: state.patientId,
          age: state.patientDemographics?.age,
          gender: state.patientDemographics?.gender,
          admissionType: state.patientDemographics?.admission_type,
          riskTier: state.patientDemographics?.risk_tier,
          diagnosis: state.userQuery
        },
        state.isHindi
      );
      state.pmjayStatus = pmjay;
      state.agentResponse = state.isHindi
        ? `### आयुष्मान भारत PM-JAY पात्रता परिणाम\n- **पात्रता स्थिति**: ${pmjay.eligible ? "✅ योजना हेतु पूर्णतः पात्र" : "❌ अपात्र"}\n- **उपलब्ध वार्षिक बीमा कवर**: ${pmjay.coverageAmount}\n- **लाभार्थी श्रेणी**: ${pmjay.beneficiaryCategory}\n- **अस्पताल कैशलेस स्थिति**: ${pmjay.copayRequirement}\n- **पात्र उपचार व प्रक्रियाएं**: ${pmjay.eligibleProcedures.map(p => p.procedureName).join("; ")}\n- **आशा दीदी निर्देश**: ${pmjay.ashaGuidance}\n- **हेल्पलाइन**: ${pmjay.nationalHelpline}`
        : `### AYUSHMAN BHARAT PM-JAY ELIGIBILITY VERIFICATION\n- **Eligibility Status**: ${pmjay.eligible ? "ELIGIBLE" : "INELIGIBLE"}\n- **Annual Cashless Coverage**: ${pmjay.coverageAmount}\n- **Beneficiary Tier**: ${pmjay.beneficiaryCategory}\n- **Pre-Auth Status**: ${pmjay.claimPreAuthStatus}\n- **Empanelled Benefit Packages**: ${pmjay.eligibleProcedures.map(p => p.procedureName).join(", ")}\n- **Patient Copay**: ${pmjay.copayRequirement}\n- **National 24x7 Helpline**: ${pmjay.nationalHelpline}\n\n${pmjay.ashaGuidance}`;
      addAgentExecutionStep(
        state,
        "PMJAYAgent",
        "eligibility_check",
        `Verified PM-JAY entitlement: ${pmjay.coverageAmount} coverage (${pmjay.claimPreAuthStatus}).`
      );
      break;
    }

    case "abha": {
      const abha = await lookupAbhaProfile(state.patientId || state.userQuery, state.isHindi);
      state.abhaProfile = abha;
      state.agentResponse = abha.displayText;
      addAgentExecutionStep(
        state,
        "ABHAAgent",
        "identity_discovery",
        `Resolved ABHA Identity ${abha.abhaId} (${abha.linkedFacilities.length} linked health records found).`
      );
      break;
    }

    case "medication_safety":
      state = await runMedicationSafetyAgent(state);
      break;
    case "risk_analyst":
      state = await runRiskAnalystAgent(state);
      break;
    case "care_plan":
      state = await runCarePlanAgent(state);
      break;
    case "triage":
    default:
      state = await runTriageAgent(state);
      break;
  }

  // ── STEP 2B: Automatic Bharat Health Profile Enrichment ──
  // Enrich state with ABHA profile and PM-JAY eligibility if not already resolved
  if (!state.abhaProfile && state.patientId) {
    try {
      state.abhaProfile = await lookupAbhaProfile(state.patientId, state.isHindi);
    } catch {
      // Non-blocking enrichment
    }
  }

  if (!state.pmjayStatus) {
    try {
      state.pmjayStatus = await evaluatePMJAYEligibility(
        {
          patientId: state.patientId,
          age: state.patientDemographics?.age,
          gender: state.patientDemographics?.gender,
          admissionType: state.patientDemographics?.admission_type,
          riskTier: state.patientDemographics?.risk_tier,
          diagnosis: state.userQuery
        },
        state.isHindi
      );
    } catch {
      // Non-blocking enrichment
    }
  }

  // ── STEP 3: Secondary Medication Safety Screen ──
  if (
    routedAgent !== "medication_safety" &&
    (state.medications.length > 0 || state.userQuery.toLowerCase().includes("taking") || state.userQuery.toLowerCase().includes("dose"))
  ) {
    const { alerts, isCriticalBlocked } = checkDeterministicDdi(
      state.medications,
      state.userQuery,
      state.patientDemographics
    );

    if (alerts.length > 0) {
      state.medicationAlerts = alerts;
      state.isBlockedBySafety = isCriticalBlocked;

      addAgentExecutionStep(
        state,
        "Supervisor",
        "secondary_safety_screen",
        `Secondary pharmacovigilance screen found ${alerts.length} alert(s) (Critical: ${isCriticalBlocked}).`
      );

      if (isCriticalBlocked) {
        state.agentResponse =
          `⚠️ **CRITICAL PHARMACOVIGILANCE BLOCKER DETECTED**\n` +
          `${alerts[0].hazard} Recommendation: ${alerts[0].recommendation} ${alerts[0].citation}\n\n` +
          state.agentResponse;
      }
    }
  }

  // ── STEP 4: Citation Resolver & Grounding Verification ──
  const verification = verifyAndResolveCitations(
    state.agentResponse,
    state.retrievedGuidelines as any
  );

  state.agentResponse = verification.enrichedText;
  state.citations = verification.validCitations;
  state.evidenceBadges = verification.evidenceBadges;
  state.groundingFidelity = verification.groundingFidelity;
  state.isGrounded = verification.isGrounded;

  addAgentExecutionStep(
    state,
    "Supervisor",
    "grounding_verification",
    `Verified grounding fidelity=${verification.groundingFidelity} (${verification.validCitations.length} citations, ${verification.evidenceBadges.length} badges).`,
    {
      fidelity: verification.groundingFidelity,
      isGrounded: verification.isGrounded,
      validCitations: verification.validCitations,
      hallucinations: verification.hallucinatedCitations
    }
  );

  return state;
}

export const runSupervisor = traceable(_runSupervisor, {
  name: "CareLink Multi-Agent Clinical Supervisor",
  run_type: "chain",
  project_name: process.env.LANGSMITH_PROJECT || "carelink-clinical-agent"
});
