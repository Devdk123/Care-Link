/**
 * CareLink LiveKit Voice Agent Module
 * 
 * Safety & Clinical Rules:
 * 1. Identification & Brevity: Speaks concise briefing in < 25 seconds (< 45 words).
 * 2. Zero-Hallucination: Strictly reads verified physiological facts (SpO2, HR, Ward, Bed, Case ID).
 * 3. Prohibited: Diagnoses, ungrounded treatments, dosage prescriptions.
 * 4. Natural Conversational Acknowledgement Listener: Matches English and Indic affirmative intents + DTMF 1.
 */

import { VoiceEscalationMetadata, CallStatus } from './types';
import { escalationService } from './escalationService';

export interface VoiceBriefing {
  spokenText: string;
  wordCount: number;
  estimatedDurationSec: number;
  language: string;
}

export interface AckDetectionResult {
  isAcknowledged: boolean;
  confidence: number;
  detectedPhrase?: string;
  normalizedAck?: string;
}

/**
 * Positive conversational acknowledgement keywords in English and Indic languages
 */
const ACKNOWLEDGEMENT_PATTERNS: Array<{ regex: RegExp; phrase: string; confidence: number }> = [
  // English Affirmations
  { regex: /\b(acknowledge|acknowledged|i acknowledge)\b/i, phrase: 'acknowledged', confidence: 0.99 },
  { regex: /\b(i['’]?m on it|i am on it|on it)\b/i, phrase: 'on it', confidence: 0.98 },
  { regex: /\b(i['’]?ll handle it|i am handling it|handling it|handle it)\b/i, phrase: 'handling it', confidence: 0.98 },
  { regex: /\b(i['’]?m attending|attending bed|attending patient|coming to bed)\b/i, phrase: 'attending', confidence: 0.97 },
  { regex: /\b(noted|copy that|received|understood|confirmed)\b/i, phrase: 'noted', confidence: 0.95 },
  { regex: /\b(1|one|press 1)\b/i, phrase: 'DTMF 1', confidence: 0.99 },

  // Hindi Affirmations
  { regex: /(स्वीकार|स्वीकार किया|नोट किया|समझ गया|मैं देख रहा हूँ|पहुँच रहा हूँ)/i, phrase: 'hindi_acknowledged', confidence: 0.99 },
  // Tamil Affirmations
  { regex: /(ஏற்றுக்கொண்டேன்|பார்த்துக்கொள்கிறேன்|புரிந்தது)/i, phrase: 'tamil_acknowledged', confidence: 0.99 },
  // Telugu Affirmations
  { regex: /(అంగీకరించబడింది|చూస్తున్నాను|అర్థమైంది)/i, phrase: 'telugu_acknowledged', confidence: 0.99 },
];

/**
 * Generate standardized clinical voice briefing under 25 seconds
 */
export function generateVoiceBriefingPrompt(metadata: VoiceEscalationMetadata): VoiceBriefing {
  const lang = metadata.preferredLanguage || 'en-IN';

  let spokenText = '';

  if (lang.startsWith('hi')) {
    spokenText = `यह केयरलिंक क्लिनिकल अलर्ट है। वार्ड ${metadata.ward}, बेड ${metadata.bed}, केस ${metadata.caseId} के लिए गंभीर हाइपोक्सिया। मरीज का ऑक्सीजन स्तर ${metadata.spo2} प्रतिशत है। स्वीकार करने के लिए 1 दबाएं या बोलें।`;
  } else if (lang.startsWith('ta')) {
    spokenText = `இது கேர்லிங்க் அவசர மருத்துவ எச்சரிக்கை. வார்டு ${metadata.ward}, படுக்கை ${metadata.bed}, வழக்கு ${metadata.caseId}. ஆக்ஸிஜன் அளவு ${metadata.spo2} சதவீதம். உறுதிப்படுத்த 1 அழுத்தவும் அல்லது பேசவும்.`;
  } else if (lang.startsWith('te')) {
    spokenText = `ఇది కేర్‌లింక్ అత్యవసర అలర్ట్. వార్డు ${metadata.ward}, బెడ్ ${metadata.bed}, కేస్ ${metadata.caseId}. ఆక్సిజన్ స్థాయి ${metadata.spo2} శాతం. ధృవీకరించడానికి 1 నొక్కండి లేదా మాట్లాడండి.`;
  } else {
    // Standard Clinical English Briefing (< 35 words)
    spokenText = `This is CareLink automated clinical escalation. Critical alert for case ${metadata.caseId} at ${metadata.ward}, ${metadata.bed}. Oxygen saturation is ${metadata.spo2} percent${
      metadata.heartRate ? `, heart rate ${metadata.heartRate} beats per minute` : ''
    }. Press 1 or speak to acknowledge.`;
  }

  const words = spokenText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  // Average speaking rate: ~2.5 words per second
  const estimatedDurationSec = Math.max(4, Math.round(wordCount / 2.3));

  return {
    spokenText,
    wordCount,
    estimatedDurationSec,
    language: lang,
  };
}

/**
 * Detect conversational clinician acknowledgement from speech-to-text transcript or DTMF
 */
export function detectConversationalAcknowledgement(transcript: string): AckDetectionResult {
  const clean = (transcript || '').trim();
  if (!clean) {
    return { isAcknowledged: false, confidence: 0 };
  }

  for (const pattern of ACKNOWLEDGEMENT_PATTERNS) {
    if (pattern.regex.test(clean)) {
      return {
        isAcknowledged: true,
        confidence: pattern.confidence,
        detectedPhrase: pattern.phrase,
        normalizedAck: `Clinician verified: "${clean}"`,
      };
    }
  }

  return { isAcknowledged: false, confidence: 0 };
}

/**
 * Process a conversational speech turn in a LiveKit room
 */
export function processVoiceAgentTurn(
  callId: string,
  userTranscript: string,
  clinicianName: string = 'Duty Intensivist'
): {
  isResolved: boolean;
  agentResponseText: string;
  callStatus: CallStatus;
} {
  const ackCheck = detectConversationalAcknowledgement(userTranscript);

  if (ackCheck.isAcknowledged) {
    escalationService.acknowledgeCall(callId, {
      acknowledgedBy: clinicianName,
      verbalSnippet: userTranscript,
    });

    return {
      isResolved: true,
      agentResponseText: 'Thank you doctor. Alert acknowledged and logged in CareLink audit timeline. Terminating escalation call.',
      callStatus: 'ACKNOWLEDGED',
    };
  }

  // Not recognized as ack: prompt clinician again
  return {
    isResolved: false,
    agentResponseText: 'Please say acknowledge or press 1 to confirm you are attending to this patient.',
    callStatus: 'IN_PROGRESS',
  };
}
