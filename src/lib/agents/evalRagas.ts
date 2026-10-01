/**
 * CareLink Clinical RAGAS Evaluation Engine (TypeScript)
 * Evaluates multi-agent clinical responses on three standardized RAGAS metrics:
 * 1. Faithfulness (Claims verified against retrieved guidelines)
 * 2. Context Precision (Relevance and ranking of retrieved clinical guidelines)
 * 3. Answer Relevancy (Alignment of clinical response to physician query)
 */

import { CLINICAL_GUIDELINES, searchClinicalGuidelines } from '../clinicalRag';
import { verifyAndResolveCitations } from '../citationResolver';

export interface RagasScoreResult {
  faithfulness: number;
  contextPrecision: number;
  answerRelevancy: number;
  compositeScore: number;
  isPassed: boolean;
  verdict: 'EXCELLENT' | 'PASS' | 'AMBER' | 'FAIL';
  details: {
    totalClaimsChecked: number;
    supportedClaimsCount: number;
    unsupportedClaims: string[];
    retrievedGuidelineTags: string[];
    relevantGuidelineCount: number;
    hallucinationRisk: 'NONE' | 'LOW' | 'HIGH';
  };
}

export interface ClinicalBenchmarkCase {
  id: string;
  name: string;
  query: string;
  expectedGuidelineTags: string[];
  expectedUrgencyOrAction: string;
  vitals?: Record<string, number>;
  medications?: string[];
}

export const CLINICAL_BENCHMARK_CASES: ClinicalBenchmarkCase[] = [
  {
    id: 'case_hf_decomp',
    name: 'Acute Heart Failure Decompensation',
    query: 'Patient with severe dyspnea, orthopnea, bilateral lower extremity edema, and BNP 1400 pg/mL.',
    expectedGuidelineTags: ['ICMR-HF-01', 'AHA-DDI-01'],
    expectedUrgencyOrAction: 'Urgent',
    vitals: { hr: 108, sbp: 165, dbp: 98, spo2: 89, rr: 28, temp: 98.6 },
    medications: ['Furosemide 40mg', 'Lisinopril 10mg']
  },
  {
    id: 'case_warfarin_nsaid',
    name: 'Warfarin & NSAID Severe Gastrointestinal Hemorrhage Risk',
    query: 'Patient on therapeutic Warfarin 5mg daily for atrial fibrillation asks to take Ibuprofen 800mg TID for acute knee arthritis pain.',
    expectedGuidelineTags: ['AHA-DDI-01'],
    expectedUrgencyOrAction: 'CRITICAL',
    vitals: { hr: 74, sbp: 128, dbp: 82, spo2: 98, rr: 14, temp: 98.4 },
    medications: ['Warfarin 5mg', 'Ibuprofen 800mg']
  },
  {
    id: 'case_metformin_ckd',
    name: 'Metformin Lactic Acidosis in Advanced Renal Impairment',
    query: 'Type 2 diabetic patient with chronic kidney disease eGFR 24 mL/min/1.73m2 currently prescribed Metformin 1000mg BID.',
    expectedGuidelineTags: ['KDIGO-CKD-01', 'ICMR-DM-01'],
    expectedUrgencyOrAction: 'CRITICAL',
    vitals: { hr: 80, sbp: 135, dbp: 85, spo2: 97, rr: 16, temp: 98.2 },
    medications: ['Metformin 1000mg']
  },
  {
    id: 'case_pediatric_fever',
    name: 'Pediatric High Pyrexia Danger Signs',
    query: '18-month old infant with fever of 39.8C, extreme lethargy, refusal of fluids, and grunting respiration.',
    expectedGuidelineTags: ['IAP-PEDS-01'],
    expectedUrgencyOrAction: 'Emergency',
    vitals: { hr: 165, sbp: 90, dbp: 55, spo2: 93, rr: 52, temp: 39.8 },
    medications: ['Paracetamol drop']
  },
  {
    id: 'case_copd_hypoxia',
    name: 'Severe COPD Exacerbation with Hypercapnic Respiratory Failure',
    query: 'Elderly patient with chronic COPD presenting with severe respiratory fatigue, drowsiness, and SpO2 84% on room air.',
    expectedGuidelineTags: ['WHO-RESP-01', 'NICE-CG-01'],
    expectedUrgencyOrAction: 'Emergency',
    vitals: { hr: 118, sbp: 142, dbp: 88, spo2: 84, rr: 34, temp: 98.9 },
    medications: ['Salbutamol inhaler', 'Tiotropium']
  }
];

export const RAGAS_PASS_THRESHOLD = 0.70;
export const RAGAS_EXCELLENT_THRESHOLD = 0.85;

/**
 * Evaluates an agent answer against retrieved context guidelines using RAGAS metrics.
 */
export function evaluateRagasMetrics(
  query: string,
  answer: string,
  retrievedGuidelines: Array<{ tag: string; title: string; content?: string; snippet?: string }>,
  expectedGuidelineTags: string[] = []
): RagasScoreResult {
  // 1. Faithfulness Metric
  // Verify citation grounding fidelity and claim adherence
  const citationVerification = verifyAndResolveCitations(answer, retrievedGuidelines);
  const citationFidelity = citationVerification.groundingFidelity;

  // Split response into key clinical statements
  const claims = answer
    .split(/\n|\.\s+/)
    .map(c => c.trim())
    .filter(c => c.length > 25 && !c.startsWith('#') && !c.startsWith('-'));

  let supportedClaimsCount = 0;
  const unsupportedClaims: string[] = [];

  const combinedContextText = retrievedGuidelines
    .map(g => `${g.tag} ${g.title} ${g.content || g.snippet || ''}`)
    .join(' ')
    .toLowerCase();

  for (const claim of claims) {
    const claimWords = claim.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 4);
    if (claimWords.length === 0) continue;
    
    // Check overlap of claim key terms with guideline knowledge base
    const matchingWords = claimWords.filter(w => combinedContextText.includes(w));
    const overlapRatio = matchingWords.length / claimWords.length;

    if (overlapRatio >= 0.35 && citationVerification.isGrounded) {
      supportedClaimsCount++;
    } else if (overlapRatio >= 0.50) {
      supportedClaimsCount++;
    } else {
      unsupportedClaims.push(claim);
    }
  }

  const claimRatio = claims.length > 0 ? supportedClaimsCount / claims.length : 1.0;
  // Blend citation resolution score with claim adherence
  const faithfulness = Number((0.5 * citationFidelity + 0.5 * claimRatio).toFixed(3));

  // 2. Context Precision Metric
  // Evaluates whether the retrieved guidelines are relevant to the query and matches expectations
  const retrievedTags = retrievedGuidelines.map(g => g.tag);
  const cleanExpected = new Set(expectedGuidelineTags.map(t => t.replace(/[\[\]]/g, '').trim().toUpperCase()));
  let relevantCount = 0;

  if (cleanExpected.size > 0) {
    for (const tag of retrievedTags) {
      const cleanTag = tag.replace(/[\[\]]/g, '').trim().toUpperCase();
      if (cleanExpected.has(cleanTag)) {
        relevantCount++;
      }
    }
  } else {
    // If no explicit expectation, any retrieved guideline scoring relevance
    relevantCount = retrievedTags.length;
  }

  const denom = cleanExpected.size > 0 ? cleanExpected.size : retrievedTags.length || 1;
  const contextPrecision = retrievedTags.length > 0
    ? Number(Math.min(1.0, relevantCount / denom).toFixed(3))
    : 0.5;

  // 3. Answer Relevancy Metric
  // Checks if key clinical elements of the user query appear in the response
  const queryWords = query.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 3);
  const answerLower = answer.toLowerCase();
  const matchedQueryTerms = queryWords.filter(w => answerLower.includes(w));
  const answerRelevancy = queryWords.length > 0
    ? Number(Math.min(1.0, (matchedQueryTerms.length / queryWords.length) * 1.25).toFixed(3))
    : 0.85;

  // 4. Composite RAGAS Score
  // Weighted harmonic: 40% Faithfulness + 30% Context Precision + 30% Answer Relevancy
  const compositeScore = Number((0.4 * faithfulness + 0.3 * contextPrecision + 0.3 * answerRelevancy).toFixed(3));

  const isPassed = compositeScore >= RAGAS_PASS_THRESHOLD;
  let verdict: 'EXCELLENT' | 'PASS' | 'AMBER' | 'FAIL' = 'FAIL';
  if (compositeScore >= RAGAS_EXCELLENT_THRESHOLD) {
    verdict = 'EXCELLENT';
  } else if (compositeScore >= RAGAS_PASS_THRESHOLD) {
    verdict = 'PASS';
  } else if (compositeScore >= 0.50) {
    verdict = 'AMBER';
  }

  return {
    faithfulness,
    contextPrecision,
    answerRelevancy,
    compositeScore,
    isPassed,
    verdict,
    details: {
      totalClaimsChecked: claims.length,
      supportedClaimsCount,
      unsupportedClaims: unsupportedClaims.slice(0, 3),
      retrievedGuidelineTags: retrievedTags,
      relevantGuidelineCount: relevantCount,
      hallucinationRisk: unsupportedClaims.length === 0 ? 'NONE' : unsupportedClaims.length <= 1 ? 'LOW' : 'HIGH'
    }
  };
}
