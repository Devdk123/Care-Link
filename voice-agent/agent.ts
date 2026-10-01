/**
 * CareLink LiveKit Voice Agent Worker
 * 
 * Clinical Escalation Agent:
 * - Listens in room: carelink-alert-{alertId}
 * - Delivers factual briefing under 25 seconds
 * - Listens for clinician verbal affirmation ("I'm on it", "Acknowledge", DTMF 1)
 * - Triggers closed-loop state resolution
 */

import {
  generateVoiceBriefingPrompt,
  detectConversationalAcknowledgement,
  processVoiceAgentTurn,
} from '../src/lib/telephony/voiceAgent';
import { VoiceEscalationMetadata } from '../src/lib/telephony/types';

export class CareLinkVoiceAgentWorker {
  private agentName: string = 'carelink-escalation-agent';

  constructor(customName?: string) {
    if (customName) {
      this.agentName = customName;
    }
  }

  public getAgentName(): string {
    return this.agentName;
  }

  /**
   * Generates initial audio briefing text for the agent to speak upon clinician pickup
   */
  public getBriefingPrompt(metadata: VoiceEscalationMetadata) {
    return generateVoiceBriefingPrompt(metadata);
  }

  /**
   * Evaluates clinician voice response and decides whether loop is closed
   */
  public evaluateClinicianResponse(callId: string, transcript: string, clinicianName?: string) {
    return processVoiceAgentTurn(callId, transcript, clinicianName);
  }

  /**
   * Direct pattern detector for speech recognition
   */
  public checkAcknowledgement(transcript: string) {
    return detectConversationalAcknowledgement(transcript);
  }
}

export const carelinkVoiceAgentWorker = new CareLinkVoiceAgentWorker();
