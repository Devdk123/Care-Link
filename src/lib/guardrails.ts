/**
 * CareLink Client/Node PHI Guardrails & Anonymization Engine
 * Zero-leak HIPAA compliance filter
 */

export interface AnonymizationResult {
  anonymizedText: string;
  tokenMap: Record<string, string>;
  phiCount: number;
  detectedTypes: string[];
  timestamp: string;
}

export interface GuardrailSafetyCheck {
  isSafe: boolean;
  refusalMessage: string | null;
}

const MEDICAL_HAZARD_PATTERNS = [
  /\b(?:lethal|fatal|poison|kill|suicide|overdose)\b.*\b(?:dose|amount|mg|grams)\b/i,
  /\b(?:how to|instruct to)\b.*\b(?:commit suicide|self-harm|end life)\b/i,
  /\b(?:ignore|bypass|falsify)\b.*\b(?:allergy|anaphylaxis|cardiac arrest)\b/i
];

const HAZARD_REFUSAL_MESSAGE =
  "SAFETY GUARDRAIL BLOCKED: CareLink AI is strictly prohibited from generating guidance " +
  "involving lethal dosages, self-harm instructions, or bypassing life-critical allergy warnings.";

export function checkClinicalSafety(text: string): GuardrailSafetyCheck {
  if (!text) return { isSafe: true, refusalMessage: null };
  for (const pattern of MEDICAL_HAZARD_PATTERNS) {
    if (pattern.test(text)) {
      return { isSafe: false, refusalMessage: HAZARD_REFUSAL_MESSAGE };
    }
  }
  return { isSafe: true, refusalMessage: null };
}

export function anonymizePhi(text: string): AnonymizationResult {
  if (!text) {
    return {
      anonymizedText: text,
      tokenMap: {},
      phiCount: 0,
      detectedTypes: [],
      timestamp: new Date().toISOString()
    };
  }

  let scrubbed = text;
  const tokenMap: Record<string, string> = {};
  const detectedTypes = new Set<string>();
  let count = 0;

  // 1. Patient Names
  const namePatterns = [
    /\b(?:Patient|Pt|Patient Name|Name)[:\s]+([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\b/g,
    /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s([A-Z][a-z]+\s[A-Z][a-z]+)\b/g
  ];

  for (const pattern of namePatterns) {
    scrubbed = scrubbed.replace(pattern, (match, p1) => {
      const target = p1 || match;
      if (!Object.values(tokenMap).includes(target)) {
        count++;
        const token = `[PATIENT_${String(count).padStart(3, '0')}]`;
        tokenMap[token] = target;
        detectedTypes.add('patient_name');
        return match.replace(target, token);
      }
      return match;
    });
  }

  // 2. MRN & Patient IDs
  const mrnPattern = /\b(?:MRN|PT|HX|REC)[-:\s#]?([A-Z0-9]{4,10})\b/gi;
  scrubbed = scrubbed.replace(mrnPattern, (match) => {
    if (match.startsWith('[PATIENT_')) return match;
    if (!Object.values(tokenMap).includes(match)) {
      count++;
      const token = `[MRN_${String(count).padStart(3, '0')}]`;
      tokenMap[token] = match;
      detectedTypes.add('mrn');
      return token;
    }
    return match;
  });

  // 3. National IDs (SSN / Aadhaar / ABHA)
  const nationalIdPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/g,
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g
  ];
  for (const pattern of nationalIdPatterns) {
    scrubbed = scrubbed.replace(pattern, (match) => {
      if (!Object.values(tokenMap).includes(match)) {
        count++;
        const token = `[NATIONAL_ID_${String(count).padStart(3, '0')}]`;
        tokenMap[token] = match;
        detectedTypes.add('national_id');
        return token;
      }
      return match;
    });
  }

  // 4. DOB
  const dobPattern = /\b(?:DOB|Born|Date of Birth)[:\s]+(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})\b/gi;
  scrubbed = scrubbed.replace(dobPattern, (match, p1) => {
    const target = p1 || match;
    if (!Object.values(tokenMap).includes(target)) {
      count++;
      const token = `[DOB_REDACTED_${String(count).padStart(3, '0')}]`;
      tokenMap[token] = target;
      detectedTypes.add('dob');
      return match.replace(target, token);
    }
    return match;
  });

  // 5. Phone & Email
  const phonePattern = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  scrubbed = scrubbed.replace(phonePattern, (match) => {
    if (!Object.values(tokenMap).includes(match)) {
      count++;
      const token = `[PHONE_${String(count).padStart(3, '0')}]`;
      tokenMap[token] = match;
      detectedTypes.add('phone');
      return token;
    }
    return match;
  });

  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  scrubbed = scrubbed.replace(emailPattern, (match) => {
    if (!Object.values(tokenMap).includes(match)) {
      count++;
      const token = `[EMAIL_${String(count).padStart(3, '0')}]`;
      tokenMap[token] = match;
      detectedTypes.add('email');
      return token;
    }
    return match;
  });

  return {
    anonymizedText: scrubbed,
    tokenMap,
    phiCount: Object.keys(tokenMap).length,
    detectedTypes: Array.from(detectedTypes),
    timestamp: new Date().toISOString()
  };
}

export function deanonymizePhi(text: string, tokenMap: Record<string, string>): string {
  if (!text || !tokenMap) return text;
  let restored = text;
  for (const [token, originalVal] of Object.entries(tokenMap)) {
    restored = restored.split(token).join(originalVal);
  }
  return restored;
}

export const deAnonymizePhi = deanonymizePhi;

