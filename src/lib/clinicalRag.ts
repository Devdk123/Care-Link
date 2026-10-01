/**
 * CareLink Clinical RAG Engine (TypeScript / Client & Server)
 * Evidence-based clinical guidelines from ICMR, WHO, NICE, AHA, KDIGO, and IAP.
 * Features Qdrant Cloud vector search with local in-memory cosine fallback.
 */

export interface ClinicalGuideline {
  id: string;
  tag: string;
  title: string;
  condition: string;
  source: string;
  content: string;
  keywords: string[];
  evidenceLevel: string;
}

export interface GuidelineSearchResult {
  id: string;
  tag: string;
  title: string;
  condition: string;
  source: string;
  content: string;
  score: number;
  evidenceLevel: string;
}

export const CLINICAL_GUIDELINES: ClinicalGuideline[] = [
  {
    id: "icmr_hf_01",
    tag: "[ICMR-HF-01]",
    title: "ICMR & AHA Heart Failure Post-Discharge Protocol",
    condition: "Heart Failure / Acute Decompensated HF",
    source: "ICMR & AHA 2024 Guidelines",
    content:
      "Patients discharged following acute decompensated heart failure must receive a mandatory cardiology " +
      "or primary clinical review within 7 to 10 days post-discharge. Immediate titration of Guideline-Directed " +
      "Medical Therapy (GDMT) including ACE-inhibitors/ARBs/ARNI, beta-blockers, and SGLT2 inhibitors should be assessed. " +
      "Mandatory daily morning dry-weight monitoring: sudden weight gain exceeding 2.0 kg (4.4 lbs) in 48 hours or " +
      "worsening orthopnea/paroxysmal nocturnal dyspnea indicates fluid retention and requires immediate diuretic escalation " +
      "and urgent clinical evaluation.",
    keywords: ["heart failure", "chf", "orthopnea", "weight gain", "edema", "diuretic", "furosemide", "gdmt", "ace inhibitor", "beta blocker", "fluid retention"],
    evidenceLevel: "Class I, Level A"
  },
  {
    id: "icmr_dm_01",
    tag: "[ICMR-DM-01]",
    title: "ICMR Consensus Guidelines on Type 2 Diabetes & Renal Safety",
    condition: "Type 2 Diabetes Mellitus / Diabetic Nephropathy",
    source: "ICMR National Guidelines 2024",
    content:
      "All diabetic patients post-discharge must maintain HbA1c surveillance every 3 months. When initiating or titrating " +
      "Metformin or SGLT2 inhibitors (e.g. Dapagliflozin, Empagliflozin), renal function must be verified with baseline " +
      "serum creatinine and eGFR. Metformin must be immediately withheld if eGFR falls below 30 mL/min/1.73m² or in cases of " +
      "acute volume depletion/dehydration to prevent lactic acidosis. Patients should self-monitor fasting blood glucose " +
      "with a target range of 80 to 130 mg/dL and postprandial glucose under 180 mg/dL.",
    keywords: ["diabetes", "glucose", "metformin", "sglt2", "egfr", "creatinine", "hba1c", "hypoglycemia", "ketoacidosis", "lactic acidosis", "sugar"],
    evidenceLevel: "Class I, Level A"
  },
  {
    id: "gold_copd_01",
    tag: "[GOLD-COPD-01]",
    title: "GOLD & WHO Protocol for COPD Exacerbation Management",
    condition: "COPD / Chronic Respiratory Failure",
    source: "Global Initiative for Chronic Obstructive Lung Disease (GOLD 2024)",
    content:
      "Post-discharge management of COPD exacerbations requires verification of inhaler technique and adherence to combination " +
      "long-acting bronchodilators (LABA/LAMA). For patients with chronic hypercapnic respiratory failure, supplemental oxygen " +
      "titration must strictly target an SpO2 range of 88% to 92% to prevent loss of hypoxic ventilatory drive and lethal CO2 retention. " +
      "Any drop in SpO2 below 88%, acute purulent sputum production, or worsening dyspnea at rest necessitates urgent clinical review " +
      "and consideration of oral corticosteroids or antibiotics.",
    keywords: ["copd", "spo2", "oxygen", "inhaler", "dyspnea", "wheezing", "sputum", "hypoxic drive", "laba", "lama", "bronchodilator", "breathlessness"],
    evidenceLevel: "Class I, Level A"
  },
  {
    id: "nice_surg_01",
    tag: "[NICE-SURG-01]",
    title: "NICE & CDC Surgical Site Infection (SSI) Surveillance Protocol",
    condition: "Post-Operative Recovery / Surgical Wound Care",
    source: "NICE Clinical Guideline [NG125] & CDC SSI Criteria",
    content:
      "Active surgical wound surveillance must continue for at least 30 days post-discharge. Patients and caregivers must be " +
      "educated on hallmark red flag signs of Surgical Site Infection: surgical site erythema extending >2 cm from incision margins, " +
      "persistent purulent or serosanguinous drainage, escalating localized wound pain, wound dehiscence, or systemic fever " +
      "exceeding 38.0°C (100.4°F). Prophylactic surgical dressings should remain sterile, dry, and undisturbed for 48 hours unless " +
      "strike-through occurs. Active fever combined with incision breakdown requires immediate same-day surgical wound exploration.",
    keywords: ["surgery", "post-operative", "wound", "incision", "infection", "erythema", "purulent", "fever", "dehiscence", "dressing", "pus"],
    evidenceLevel: "Class I, Level A"
  },
  {
    id: "aha_ddi_01",
    tag: "[AHA-DDI-01]",
    title: "AHA & ACC Clinical Safety Alert: Anticoagulant & NSAID Interactions",
    condition: "Anticoagulation / Cardiovascular Pharmacotherapy",
    source: "AHA / ACC Cardiovascular Safety Consensus",
    content:
      "Co-administration of direct oral anticoagulants (DOACs like Apixaban, Rivaroxaban) or Warfarin with non-steroidal " +
      "anti-inflammatory drugs (NSAIDs including Ibuprofen, Naproxen, Diclofenac) increases major gastrointestinal bleeding and " +
      "fatal hemorrhagic complications by 2.5 to 3.8-fold. Concomitant use is strictly contraindicated unless under specialist " +
      "supervision with proton-pump inhibitor (PPI) gastroprotection. Acetaminophen (Paracetamol) up to 2.0g daily is the first-line " +
      "recommended analgesic for post-discharge pain management.",
    keywords: ["anticoagulant", "blood thinner", "warfarin", "apixaban", "rivaroxaban", "nsaid", "ibuprofen", "diclofenac", "bleeding", "hemorrhage", "melena", "aspirin"],
    evidenceLevel: "Class I, Level A"
  },
  {
    id: "who_sepsis_01",
    tag: "[WHO-SEPSIS-01]",
    title: "WHO Surviving Sepsis Campaign: Post-Discharge Deterioration",
    condition: "Sepsis / Severe Systemic Deterioration",
    source: "Surviving Sepsis Campaign & WHO Guidelines",
    content:
      "Rapid clinical triage of post-discharge deterioration utilizes qSOFA (quick SOFA) criteria: respiratory rate >= 22 breaths/min, " +
      "altered mental status (Glasgow Coma Scale < 15), or systolic blood pressure <= 100 mmHg. Presence of 2 or more criteria " +
      "indicates a high risk of in-hospital deterioration and secondary septic shock. Emergency medical services (EMS) must be " +
      "contacted immediately for emergency department transfer, immediate blood cultures, serum lactate, and broad-spectrum IV antimicrobials.",
    keywords: ["sepsis", "qsofa", "shock", "hypotension", "tachycardia", "altered mental", "confusion", "lactate", "fever", "chills", "deterioration"],
    evidenceLevel: "Class I, Level A"
  },
  {
    id: "aha_htn_01",
    tag: "[AHA-HTN-01]",
    title: "AHA & ESC Consensus on Hypertensive Crisis & Blood Pressure Targets",
    condition: "Hypertension / Hypertensive Urgency & Emergency",
    source: "AHA / ESC Guidelines for Management of Arterial Hypertension",
    content:
      "A blood pressure reading with Systolic BP >= 180 mmHg or Diastolic BP >= 120 mmHg in an asymptomatic patient constitutes " +
      "hypertensive urgency requiring outpatient oral antihypertensive adjustment and 24-48 hour reassessment. If severe elevation is " +
      "accompanied by new or worsening acute target organ damage (e.g. chest pain, shortness of breath, acute neurological deficits, " +
      "papilledema, visual disturbances), it is classified as a Hypertensive Emergency requiring immediate emergency department " +
      "admission for intravenous antihypertensive titration.",
    keywords: ["hypertension", "high blood pressure", "hypertensive crisis", "systolic", "diastolic", "headache", "chest pain", "amlodipine", "losartan"],
    evidenceLevel: "Class I, Level B"
  },
  {
    id: "iap_peds_01",
    tag: "[IAP-PEDS-01]",
    title: "IAP & WHO Protocol on Pediatric Febrile Illness & Dehydration",
    condition: "Pediatric Acute Illness / Dehydration",
    source: "Indian Academy of Pediatrics & WHO Guidelines",
    content:
      "In pediatric post-discharge recovery, immediate clinical review is indicated for lethargy, sunken eyes, delayed skin pinch " +
      "retraction (> 2 seconds), persistent vomiting, or body temperature exceeding 39.0°C (102.2°F). Oral Rehydration Salts (ORS) " +
      "with WHO low-osmolarity formulation should be administered at 50-100 mL/kg over 4 hours for mild-to-moderate dehydration. " +
      "Weight-based paracetamol (15 mg/kg every 4-6 hours, max 60 mg/kg/day) is indicated for fever distress. Aspirin is strictly " +
      "contraindicated in pediatric patients due to the risk of Reye's syndrome.",
    keywords: ["pediatric", "child", "infant", "fever", "dehydration", "ors", "vomiting", "diarrhea", "lethargy", "paracetamol", "reye"],
    evidenceLevel: "Class I, Level A"
  },
  {
    id: "kdigo_ckd_01",
    tag: "[KDIGO-CKD-01]",
    title: "KDIGO Clinical Practice Guideline on Post-Discharge Renal Monitoring",
    condition: "Chronic Kidney Disease (CKD) / Acute Kidney Injury (AKI)",
    source: "Kidney Disease: Improving Global Outcomes (KDIGO 2024)",
    content:
      "Patients discharged after an episode of Acute Kidney Injury (AKI) or with CKD Stages 3-5 (eGFR < 60 mL/min/1.73m²) must " +
      "have serum electrolytes, creatinine, and eGFR reassessed within 14 days post-discharge. If serum potassium exceeds 5.5 mEq/L " +
      "(hyperkalemia), RAAS inhibitors (ACE-i, ARBs, MRAs) must be reviewed and dietary potassium restricted. Avoidance of nephrotoxic " +
      "agents including NSAIDs, intravenous radiocontrast, and aminoglycosides is imperative.",
    keywords: ["ckd", "kidney", "renal", "egfr", "creatinine", "potassium", "hyperkalemia", "aki", "nephrotoxic"],
    evidenceLevel: "Class I, Level A"
  },
  {
    id: "stent_cad_01",
    tag: "[STENT-CAD-01]",
    title: "ACC & AHA Guidelines on Post-PCI Dual Antiplatelet Therapy (DAPT)",
    condition: "Coronary Artery Disease / Post-Stent Implantation",
    source: "ACC / AHA Coronary Revascularization Guidelines",
    content:
      "Patients undergoing percutaneous coronary intervention (PCI) with drug-eluting stent (DES) implantation must maintain " +
      "uninterrupted Dual Antiplatelet Therapy (DAPT) comprising Aspirin (75-100 mg daily) plus a P2Y12 inhibitor (Ticagrelor, " +
      "Prasugrel, or Clopidogrel) for a minimum of 12 months for Acute Coronary Syndrome (ACS) or 6 months for stable ischemic heart disease. " +
      "Premature discontinuation of DAPT dramatically increases the catastrophic risk of acute stent thrombosis, myocardial infarction, " +
      "and sudden cardiac death.",
    keywords: ["stent", "pci", "dapt", "aspirin", "clopidogrel", "ticagrelor", "heart attack", "coronary", "chest pain", "thrombosis"],
    evidenceLevel: "Class I, Level A"
  }
];

function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateHashVector(text: string, dim = 384): number[] {
  const words = (text.toLowerCase().match(/[a-z0-9]+/g) || []);
  const vec = new Array(dim).fill(0);
  if (words.length === 0) return vec;

  for (let i = 0; i < words.length; i++) {
    const h = stringHash(words[i]) % dim;
    vec[h] += 1.0;
    if (i < words.length - 1) {
      const h2 = stringHash(`${words[i]}_${words[i + 1]}`) % dim;
      vec[h2] += 1.5;
    }
  }

  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      vec[i] /= norm;
    }
  }
  return vec;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  if (normA === 0 || normB === 0) return 0;
  return Math.max(0, Math.min(1, dot / (normA * normB)));
}

// Pre-computed guideline vectors
const GUIDELINE_VECTORS: Map<string, number[]> = new Map();
for (const g of CLINICAL_GUIDELINES) {
  const fullText = `${g.title} ${g.condition} ${g.content} ${g.keywords.join(" ")}`;
  GUIDELINE_VECTORS.set(g.id, generateHashVector(fullText, 384));
}

export async function searchClinicalGuidelines(
  query: string,
  topK = 3,
  minScore = 0.05
): Promise<GuidelineSearchResult[]> {
  if (!query) return [];

  // Try Qdrant Cloud via fetch if configured
  const qdrantUrl = (process.env.QDRANT_URL || process.env.VITE_QDRANT_URL || "").replace(/\/+$/, "");
  const qdrantKey = process.env.QDRANT_API_KEY || process.env.VITE_QDRANT_API_KEY || "";

  if (qdrantUrl && qdrantKey && typeof fetch !== "undefined") {
    try {
      const queryVec = generateHashVector(query, 384);
      const res = await fetch(`${qdrantUrl}/collections/carelink_guidelines/points/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": qdrantKey
        },
        body: JSON.stringify({
          vector: queryVec,
          limit: topK,
          with_payload: true
        })
      });

      if (res.ok) {
        const json = await res.json();
        const hits = json.result || [];
        const results: GuidelineSearchResult[] = [];

        for (const hit of hits) {
          const payload = hit.payload || {};
          const score = Number(hit.score || 0);
          if (score >= minScore) {
            results.push({
              id: payload.id || "",
              tag: payload.tag || "",
              title: payload.title || "",
              condition: payload.condition || "",
              source: payload.source || "",
              content: payload.content || "",
              evidenceLevel: payload.evidence_level || payload.evidenceLevel || "Class I",
              score: Math.round(score * 1000) / 1000
            });
          }
        }
        if (results.length > 0) {
          return results;
        }
      }
    } catch {
      // Fallback silently to local in-memory cosine engine
    }
  }

  // Fallback: Local In-Memory Semantic Matching
  return searchGuidelinesLocal(query, topK, minScore);
}

export function searchGuidelinesLocal(
  query: string,
  topK = 3,
  minScore = 0.05
): GuidelineSearchResult[] {
  const queryVec = generateHashVector(query, 384);
  const qLower = query.toLowerCase();

  const scored: Array<{ score: number; g: ClinicalGuideline }> = [];

  for (const g of CLINICAL_GUIDELINES) {
    const gVec = GUIDELINE_VECTORS.get(g.id) || [];
    const cosine = cosineSimilarity(queryVec, gVec);

    let matchCount = 0;
    for (const kw of g.keywords) {
      if (qLower.includes(kw.toLowerCase())) {
        matchCount++;
      }
    }
    const keywordBoost = Math.min(0.35, matchCount * 0.10);
    const totalScore = cosine + keywordBoost;

    if (totalScore >= minScore) {
      scored.push({ score: totalScore, g });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map(({ score, g }) => ({
    id: g.id,
    tag: g.tag,
    title: g.title,
    condition: g.condition,
    source: g.source,
    content: g.content,
    evidenceLevel: g.evidenceLevel,
    score: Math.round(score * 1000) / 1000
  }));
}

export function formatGuidelinesForPrompt(guidelines: GuidelineSearchResult[]): string {
  if (!guidelines || guidelines.length === 0) return "";

  const lines = [
    "── MANDATORY CLINICAL EVIDENCE & GUIDELINE CONTEXT ──",
    "You MUST ground your clinical advice on the evidence below. Whenever stating a diagnostic, " +
    "medication, or escalation recommendation, include the corresponding bracketed citation (e.g. `[ICMR-HF-01]`).",
    ""
  ];

  guidelines.forEach((g, idx) => {
    lines.push(`${idx + 1}. ${g.tag} - ${g.title} (${g.source}) [Evidence: ${g.evidenceLevel}]`);
    lines.push(`   Target Condition: ${g.condition}`);
    lines.push(`   Guideline Mandate: ${g.content}`);
    lines.push("");
  });

  lines.push("─────────────────────────────────────────────────────");
  return lines.join("\n");
}
