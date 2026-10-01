/**
 * CareLink Medication Safety Specialist Agent (TypeScript)
 * Deterministic DDI checking + Pharmacovigilance safety gates.
 */

import { CareLinkAgentState, MedicationAlert, addAgentExecutionStep } from "./state";
import { searchClinicalGuidelines, formatGuidelinesForPrompt } from "../clinicalRag";
import { callWithFailover } from "../failoverLlm";

const ANTICOAGULANTS = ["warfarin", "apixaban", "rivaroxaban", "dabigatran", "edoxaban", "heparin", "enoxaparin"];
const NSAIDS = ["ibuprofen", "naproxen", "diclofenac", "ketorolac", "meloxicam", "indomethacin", "celecoxib"];
const ACE_INHIBITORS = ["lisinopril", "ramipril", "enalapril", "benazepril", "captopril", "perindopril"];
const ARBS = ["losartan", "valsartan", "telmisartan", "candesartan", "irbesartan", "olmesartan"];

export function checkDeterministicDdi(
  medications: string[],
  query = "",
  demographics: Record<string, any> = {}
): { alerts: MedicationAlert[]; isCriticalBlocked: boolean } {
  const alerts: MedicationAlert[] = [];
  let isCriticalBlocked = false;

  const allText = `${medications.join(" ")} ${query}`.toLowerCase();

  const foundAnticoag = ANTICOAGULANTS.filter((m) => allText.includes(m));
  const foundNsaids = NSAIDS.filter((m) => allText.includes(m));
  const foundAce = ACE_INHIBITORS.filter((m) => allText.includes(m));
  const foundArbs = ARBS.filter((m) => allText.includes(m));

  // Rule 1: Anticoagulant + NSAID
  if (foundAnticoag.length > 0 && foundNsaids.length > 0) {
    isCriticalBlocked = true;
    alerts.push({
      severity: "CRITICAL",
      type: "Drug-Drug Interaction",
      drugs: `${foundAnticoag.join(", ")} + ${foundNsaids.join(", ")}`,
      hazard: "Concomitant use increases major gastrointestinal bleeding and hemorrhagic stroke risk by 2.5-3.8x.",
      recommendation: "Discontinue NSAID immediately. Substitute with Acetaminophen (Paracetamol) up to 2g daily for pain relief.",
      citation: "[AHA-DDI-01]"
    });
  }

  // Rule 2: Dual RAAS Blockade
  if (foundAce.length > 0 && foundArbs.length > 0) {
    alerts.push({
      severity: "WARNING",
      type: "Dual RAAS Blockade",
      drugs: `${foundAce.join(", ")} + ${foundArbs.join(", ")}`,
      hazard: "Combining ACE inhibitors and ARBs significantly increases hyperkalemia, hypotension, and acute kidney failure.",
      recommendation: "Monotherapy with single RAAS agent is standard of care. Re-evaluate nephrology regimen.",
      citation: "[KDIGO-CKD-01]"
    });
  }

  // Rule 3: Metformin with eGFR < 30
  const egfr = demographics.egfr ?? demographics.eGFR;
  if (allText.includes("metformin") && egfr !== undefined) {
    const valEgfr = Number(egfr);
    if (!isNaN(valEgfr) && valEgfr < 30) {
      isCriticalBlocked = true;
      alerts.push({
        severity: "CRITICAL",
        type: "Renal Clearance Contraindication",
        drugs: "Metformin",
        hazard: `eGFR is severely compromised (${valEgfr} mL/min/1.73m² < 30). Extreme risk of fatal lactic acidosis.`,
        recommendation: "Withhold Metformin immediately. Switch to insulin or safe DPP-4 inhibitor.",
        citation: "[ICMR-DM-01]"
      });
    }
  }

  return { alerts, isCriticalBlocked };
}

export async function runMedicationSafetyAgent(state: CareLinkAgentState): Promise<CareLinkAgentState> {
  const { alerts, isCriticalBlocked } = checkDeterministicDdi(
    state.medications,
    state.userQuery,
    state.patientDemographics
  );

  state.medicationAlerts = alerts;
  state.isBlockedBySafety = isCriticalBlocked;

  addAgentExecutionStep(
    state,
    "MedicationSafetyAgent",
    "ddi_safety_scan",
    `Identified ${alerts.length} alert(s) (Critical Blocker: ${isCriticalBlocked}).`
  );

  const searchTerms = `${state.userQuery} ${state.medications.join(" ")} drug interaction contraindication safety`;
  const retrieved = await searchClinicalGuidelines(searchTerms, 2, 0.01);
  state.retrievedGuidelines = retrieved;

  const promptContext = formatGuidelinesForPrompt(retrieved);
  addAgentExecutionStep(
    state,
    "MedicationSafetyAgent",
    "clinical_rag_retrieval",
    `Retrieved ${retrieved.length} guideline(s): ${retrieved.map((r) => r.tag).join(", ") || "None"}`
  );

  const systemPrompt = `You are CareLink's Clinical Pharmacovigilance & Medication Safety Specialist Agent.
Review the patient's active and proposed medications for safety hazards, DDIs, and organ clearance limits.
Structure your output as follows:

### CLINICAL MEDICATION SAFETY AUDIT
- **Safety Gate Status**: [CLEAR | WARNING | BLOCKED - CRITICAL HAZARD]
- **Detected Adverse Interactions**: [Detail any DDIs, renal contraindications, or bleeding risks]
- **Clinical Action & Safe Alternatives**: [Recommend safe replacements, dosages, or discontinuation]
- **Monitoring Mandate**: [Mandatory lab surveillance, e.g. eGFR or potassium tracking]

MANDATORY REQUIREMENT: Reference evidence-backed guideline citations (e.g. [AHA-DDI-01], [ICMR-DM-01]).

${promptContext}`;

  const userMessage = `Query/Prescription: ${state.userQuery}
Medications Under Review: ${JSON.stringify(state.medications)}
Automated Safety Findings: ${JSON.stringify(alerts)}
Critical Safety Gate: ${isCriticalBlocked ? "BLOCKED" : "CLEAR"}
Generate the clinical medication safety audit now.`;

  const fallbackText = `### CLINICAL MEDICATION SAFETY AUDIT\n- **Safety Gate Status**: ${isCriticalBlocked ? "BLOCKED - CRITICAL HAZARD" : alerts.length > 0 ? "WARNING" : "CLEAR"}\n- **Detected Adverse Interactions**: ${alerts.map((a) => a.hazard).join(" ") || "No severe adverse interactions detected."}\n- **Clinical Action & Safe Alternatives**: ${alerts.map((a) => a.recommendation).join(" ") || "Continue medication as prescribed."} [AHA-DDI-01]\n- **Monitoring Mandate**: Surveillance of renal panel and hemoglobin [ICMR-DM-01].`;

  const result = await callWithFailover({
    systemPrompt,
    userMessage,
    maxTokens: 500,
    fallbackText
  });

  state.agentResponse = result.data;
  state.routedAgent = "medication_safety";

  addAgentExecutionStep(
    state,
    "MedicationSafetyAgent",
    "medication_safety_audit",
    `Generated medication safety audit via ${result.metrics.provider} (${result.metrics.latencyMs}ms).`,
    result.metrics
  );

  return state;
}
