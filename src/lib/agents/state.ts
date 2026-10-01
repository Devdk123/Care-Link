/**
 * CareLink Multi-Agent State Definition (TypeScript)
 * Single source of truth for the multi-agent state shape.
 */

import type { PMJAYEligibilityResult } from "./pmjayAgent";
import type { AbhaProfileResult } from "./abhaAgent";

export const CLINICAL_INTENTS = [
  "triage",
  "risk_analyst",
  "care_plan",
  "medication_safety",
  "pmjay",
  "abha"
] as const;
export type ClinicalIntent = (typeof CLINICAL_INTENTS)[number];
export const DEFAULT_INTENT: ClinicalIntent = "triage";
export const CONFIDENCE_FLOOR = 0.60;

export interface AgentExecutionStep {
  stepId: number;
  agent: string;
  action: string;
  detail: string;
  metrics?: Record<string, any>;
  timestamp: string;
}

export interface MedicationAlert {
  severity: "CRITICAL" | "WARNING" | "INFO";
  type: string;
  drugs: string;
  hazard: string;
  recommendation: string;
  citation: string;
}

export interface CareLinkAgentState {
  userQuery: string;
  patientId?: string;
  patientDemographics: Record<string, any>;
  vitals: Record<string, any>;
  medications: string[];
  intent: string;
  routingConfidence: number;
  routedAgent: string;
  isHindi?: boolean;
  pmjayStatus?: PMJAYEligibilityResult;
  abhaProfile?: AbhaProfileResult;
  retrievedGuidelines: Array<Record<string, any>>;
  agentResponse: string;
  citations: string[];
  evidenceBadges: Array<Record<string, any>>;
  groundingFidelity: number;
  isGrounded: boolean;
  medicationAlerts: MedicationAlert[];
  isBlockedBySafety: boolean;
  executionSteps: AgentExecutionStep[];
  sessionId: string;
  memoryContext: string[];
  messages: Array<Record<string, any>>;
}

export function createInitialAgentState(
  userQuery: string,
  options: Partial<CareLinkAgentState> = {}
): CareLinkAgentState {
  return {
    userQuery,
    patientId: options.patientId,
    patientDemographics: options.patientDemographics || {},
    vitals: options.vitals || {},
    medications: options.medications || [],
    intent: "",
    routingConfidence: 0.0,
    routedAgent: "",
    isHindi: options.isHindi || false,
    pmjayStatus: options.pmjayStatus,
    abhaProfile: options.abhaProfile,
    retrievedGuidelines: [],
    agentResponse: "",
    citations: [],
    evidenceBadges: [],
    groundingFidelity: 1.0,
    isGrounded: true,
    medicationAlerts: [],
    isBlockedBySafety: false,
    executionSteps: [],
    sessionId: options.sessionId || Math.random().toString(36).substring(2, 10),
    memoryContext: options.memoryContext || [],
    messages: []
  };
}

export function addAgentExecutionStep(
  state: CareLinkAgentState,
  agent: string,
  action: string,
  detail: string,
  metrics?: Record<string, any>
): void {
  if (!state.executionSteps) {
    state.executionSteps = [];
  }
  state.executionSteps.push({
    stepId: state.executionSteps.length + 1,
    agent,
    action,
    detail,
    metrics,
    timestamp: new Date().toISOString()
  });
}
