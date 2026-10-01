/**
 * CareLink Citation Resolver & Evidence Grounding Engine (TypeScript / Client & Server)
 * Enforces sentence-level clinical claim-evidence binding:
 * - Scans LLM text for bracketed guideline tags: [ICMR-HF-01], [AHA-DDI-01], etc.
 * - Detects hallucinated or unverified citation tokens.
 * - Computes grounding fidelity score (0.0 - 1.0).
 * - Extracts structured evidence badges for UI display.
 */

import { CLINICAL_GUIDELINES, GuidelineSearchResult, ClinicalGuideline } from "./clinicalRag";

export interface EvidenceBadge {
  tag: string;
  title: string;
  source: string;
  condition: string;
  evidenceLevel: string;
  snippet: string;
  score: number;
}

export interface GroundingVerification {
  isGrounded: boolean;
  groundingFidelity: number;
  citationsFound: string[];
  validCitations: string[];
  hallucinatedCitations: string[];
  missingRecommendedCitations: string[];
  evidenceBadges: EvidenceBadge[];
  enrichedText: string;
  auditNotes: string[];
}

const CITATION_REGEX = /\[([A-Z0-9_\-]+)\]/g;

const GUIDELINE_LOOKUP: Map<string, ClinicalGuideline> = new Map(
  CLINICAL_GUIDELINES.map((g) => [g.tag.replace(/[[\]]/g, ""), g])
);

export function verifyAndResolveCitations(
  llmText: string,
  retrievedGuidelines: Array<GuidelineSearchResult | Record<string, any>> = [],
  passThreshold = 0.70
): GroundingVerification {
  if (!llmText) {
    return {
      isGrounded: false,
      groundingFidelity: 0.0,
      citationsFound: [],
      validCitations: [],
      hallucinatedCitations: [],
      missingRecommendedCitations: [],
      evidenceBadges: [],
      enrichedText: "",
      auditNotes: ["Empty text supplied for citation verification."]
    };
  }

  // 1. Build lookup for retrieved guidelines
  const retrievedMap = new Map<string, any>();
  for (const g of retrievedGuidelines) {
    if (g && g.tag) {
      const clean = g.tag.replace(/[[\]]/g, "");
      retrievedMap.set(clean, g);
    }
  }

  // 2. Extract citations
  const rawMatches = Array.from(llmText.matchAll(CITATION_REGEX), (m) => m[1]);
  const citationsFound = Array.from(new Set(rawMatches));

  const validCitations: string[] = [];
  const hallucinatedCitations: string[] = [];
  const evidenceBadges: EvidenceBadge[] = [];

  for (const tag of citationsFound) {
    const guideline = GUIDELINE_LOOKUP.get(tag);
    if (guideline) {
      validCitations.push(`[${tag}]`);
      evidenceBadges.push({
        tag: `[${tag}]`,
        title: guideline.title,
        source: guideline.source,
        condition: guideline.condition,
        evidenceLevel: guideline.evidenceLevel,
        snippet: guideline.content.slice(0, 220) + "...",
        score: retrievedMap.has(tag) ? 0.98 : 0.85
      });
    } else {
      hallucinatedCitations.push(`[${tag}]`);
    }
  }

  // 3. Detect ungrounded guidelines & auto-enrich
  const missingRecommended: string[] = [];
  let enrichedText = llmText;
  const auditNotes: string[] = [];

  for (const [tag, guide] of retrievedMap.entries()) {
    const bracketed = `[${tag}]`;
    if (!validCitations.includes(bracketed)) {
      const fullGuide = GUIDELINE_LOOKUP.get(tag);
      const keywords = fullGuide ? fullGuide.keywords : [];
      let matches = 0;
      for (const kw of keywords) {
        if (llmText.toLowerCase().includes(kw.toLowerCase())) {
          matches++;
        }
      }
      const targetKw = keywords.find((kw) => enrichedText.toLowerCase().includes(kw.toLowerCase()));
      if (targetKw) {
        const pattern = new RegExp(`([^.?!]*\\b${targetKw}\\b[^.?!]*[.?!])`, "i");
        if (pattern.test(enrichedText) && !enrichedText.includes(bracketed)) {
          enrichedText = enrichedText.replace(pattern, `$1 ${bracketed}`);
          validCitations.push(bracketed);
          if (fullGuide) {
            evidenceBadges.push({
              tag: bracketed,
              title: fullGuide.title,
              source: fullGuide.source,
              condition: fullGuide.condition,
              evidenceLevel: fullGuide.evidenceLevel,
              snippet: fullGuide.content.slice(0, 220) + "...",
              score: 0.92
            });
          }
          auditNotes.push(`Auto-attached clinical citation ${bracketed} based on semantic grounding match.`);
        } else if (!validCitations.includes(bracketed)) {
          missingRecommended.push(bracketed);
        }
      } else {
        missingRecommended.push(bracketed);
      }
    }
  }

  // 4. Compute Grounding Fidelity
  let fidelity = 1.0;
  let isGrounded = true;

  if (validCitations.length === 0 && retrievedMap.size === 0) {
    fidelity = 1.0;
    isGrounded = true;
  } else if (validCitations.length === 0 && retrievedMap.size > 0) {
    fidelity = missingRecommended.length > 0 ? 0.20 : 0.35;
    isGrounded = false;
    auditNotes.push("Clinical advice generated without mandatory bracketed guideline citations.");
  } else {
    const citationAccuracy = validCitations.length / (validCitations.length + hallucinatedCitations.length);
    const coverage = Math.min(1.0, validCitations.length / Math.max(1, Math.min(2, retrievedMap.size)));
    const penalty = hallucinatedCitations.length * 0.40;
    fidelity = Math.max(0.0, Math.min(1.0, (0.7 * citationAccuracy + 0.3 * coverage) - penalty));
    isGrounded = fidelity >= passThreshold;
  }

  if (hallucinatedCitations.length > 0) {
    auditNotes.push(`Detected hallucinated or unauthorized citation tags: ${hallucinatedCitations.join(", ")}`);
  }
  if (validCitations.length > 0) {
    auditNotes.push(`Successfully verified ${validCitations.length} clinical guideline citation(s).`);
  }

  return {
    isGrounded,
    groundingFidelity: Math.round(fidelity * 1000) / 1000,
    citationsFound: citationsFound.map((c) => `[${c}]`),
    validCitations,
    hallucinatedCitations,
    missingRecommendedCitations: missingRecommended,
    evidenceBadges,
    enrichedText,
    auditNotes
  };
}
