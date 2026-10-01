/**
 * CareLink Ayushman Bharat PM-JAY Eligibility Checker Agent (TypeScript)
 * Evaluates patient entitlement for Pradhan Mantri Jan Arogya Yojana (AB PM-JAY)
 * Provides ₹5,00,000 annual cashless coverage per family across empanelled hospitals.
 */

export interface PMJAYProcedurePackage {
  packageCode: string;
  specialty: string;
  procedureName: string;
  standardRate: string;
  preAuthRequired: boolean;
}

export interface PMJAYEligibilityResult {
  eligible: boolean;
  schemeName: string;
  coverageAmount: string;
  beneficiaryCategory: string;
  claimPreAuthStatus: "FAST_TRACK_APPROVED" | "PRE_AUTH_REQUIRED" | "DOCUMENT_VERIFICATION_PENDING" | "INELIGIBLE";
  eligibleProcedures: PMJAYProcedurePackage[];
  empanelledHospitalNotice: string;
  copayRequirement: string;
  nationalHelpline: string;
  rationale: string;
  ashaGuidance: string;
}

export interface PatientDemographicsForPMJAY {
  patientId?: string;
  age?: number;
  gender?: string;
  admissionType?: string;
  riskTier?: string;
  diagnosis?: string;
  rationCardType?: "Antyodaya" | "BPL" | "StateHealthCard" | "APL" | "Unknown";
  annualIncomeLakhs?: number;
  isRural?: boolean;
}

// Curated PM-JAY Health Benefit Packages (HBP 2.2) mapped to CareLink disease cohorts
const PMJAY_PACKAGES: Record<string, PMJAYProcedurePackage[]> = {
  cardiac: [
    {
      packageCode: "MC001A",
      specialty: "Cardiology",
      procedureName: "Coronary Angioplasty with Drug Eluting Stent (DES)",
      standardRate: "₹65,000 - ₹90,000",
      preAuthRequired: true
    },
    {
      packageCode: "SU004B",
      specialty: "Cardiovascular Surgery",
      procedureName: "Coronary Artery Bypass Grafting (CABG)",
      standardRate: "₹1,20,000",
      preAuthRequired: true
    },
    {
      packageCode: "MC012D",
      specialty: "Cardiology",
      procedureName: "Intensive Care Management for Acute Decompensated Heart Failure",
      standardRate: "₹35,000 / week",
      preAuthRequired: false
    }
  ],
  renal: [
    {
      packageCode: "NE002A",
      specialty: "Nephrology",
      procedureName: "Hemodialysis Session (Package includes dialyzer & erythropoietin)",
      standardRate: "₹2,200 / session",
      preAuthRequired: false
    },
    {
      packageCode: "SU021A",
      specialty: "Vascular Surgery",
      procedureName: "Arteriovenous (AV) Fistula Creation for Hemodialysis Access",
      standardRate: "₹18,000",
      preAuthRequired: true
    }
  ],
  icu_emergency: [
    {
      packageCode: "ICU001",
      specialty: "Critical Care",
      procedureName: "ICU Care with Invasive Mechanical Ventilation (Up to 15 Days)",
      standardRate: "₹7,500 / day",
      preAuthRequired: false
    },
    {
      packageCode: "EM003A",
      specialty: "Emergency Medicine",
      procedureName: "Acute Septic Shock Resuscitation & Broad-Spectrum Antibiotic Therapy",
      standardRate: "₹25,000",
      preAuthRequired: false
    }
  ],
  general_medical: [
    {
      packageCode: "GM005B",
      specialty: "General Medicine",
      procedureName: "Acute COPD / Severe Bronchial Asthma Exacerbation Management",
      standardRate: "₹15,000",
      preAuthRequired: false
    },
    {
      packageCode: "GM011C",
      specialty: "Endocrinology",
      procedureName: "Complicated Type 2 Diabetes & Ketoacidosis Acute Inpatient Stabilization",
      standardRate: "₹18,000",
      preAuthRequired: false
    }
  ]
};

/**
 * Evaluates patient entitlement for Ayushman Bharat PM-JAY
 */
export async function evaluatePMJAYEligibility(
  patient: PatientDemographicsForPMJAY,
  isHindi = false
): Promise<PMJAYEligibilityResult> {
  const age = patient.age ?? 60;
  const isEmergency = (patient.admissionType || "").toLowerCase().includes("emerg");
  const isHighRisk = (patient.riskTier || "").toLowerCase().includes("high");
  const isLowIncome = (patient.annualIncomeLakhs !== undefined && patient.annualIncomeLakhs <= 2.5) ||
                      patient.rationCardType === "Antyodaya" ||
                      patient.rationCardType === "BPL" ||
                      patient.rationCardType === "StateHealthCard";

  // Eligibility heuristic: Low-income, BPL status, emergency elderly, or high readmission risk
  const eligible = isLowIncome || (isEmergency && isHighRisk) || age >= 70 || patient.rationCardType !== "APL";

  // Match relevant procedures based on diagnosis text
  const diagLower = (patient.diagnosis || "").toLowerCase();
  let matchedPackages: PMJAYProcedurePackage[] = [];

  if (diagLower.includes("heart") || diagLower.includes("chf") || diagLower.includes("card") || diagLower.includes("mi") || diagLower.includes("coronary")) {
    matchedPackages = [...PMJAY_PACKAGES.cardiac, ...PMJAY_PACKAGES.icu_emergency];
  } else if (diagLower.includes("kidney") || diagLower.includes("ckd") || diagLower.includes("renal")) {
    matchedPackages = [...PMJAY_PACKAGES.renal, ...PMJAY_PACKAGES.general_medical];
  } else if (diagLower.includes("sepsis") || isEmergency) {
    matchedPackages = [...PMJAY_PACKAGES.icu_emergency, ...PMJAY_PACKAGES.cardiac];
  } else {
    matchedPackages = [...PMJAY_PACKAGES.general_medical, ...PMJAY_PACKAGES.cardiac];
  }

  const claimStatus: PMJAYEligibilityResult["claimPreAuthStatus"] = !eligible
    ? "INELIGIBLE"
    : isEmergency
    ? "FAST_TRACK_APPROVED"
    : "PRE_AUTH_REQUIRED";

  if (isHindi) {
    return {
      eligible,
      schemeName: "आयुष्मान भारत - प्रधानमंत्री जन आरोग्य योजना (AB PM-JAY)",
      coverageAmount: eligible ? "₹5,00,000 प्रति वर्ष (प्रति परिवार)" : "शून्य",
      beneficiaryCategory: isLowIncome ? "सामाजिक-आर्थिक जाति जनगणना (SECC) पात्र परिवार" : "वरिष्ठ नागरिक / आपातकालीन श्रेणी",
      claimPreAuthStatus: claimStatus,
      eligibleProcedures: matchedPackages,
      empanelledHospitalNotice: "यह अस्पताल AB PM-JAY के तहत सूचीबद्ध है। मरीज़ को बिना किसी अग्रिम भुगतान के पूर्णतः कैशलेस उपचार मिलेगा।",
      copayRequirement: "शून्य जेब खर्च (100% कैशलेस अस्पताल भर्ती)",
      nationalHelpline: "14555 / 1800-111-565 (टोल फ्री 24x7)",
      rationale: eligible
        ? `मरीज़ की उम्र (${age} वर्ष) और भर्ती स्थिति (${patient.admissionType || "आपातकालीन"}) के आधार पर मरीज़ आयुष्मान भारत योजना के अंतर्गत ₹5 लाख के कैशलेस कवर का हकदार है।`
        : "मरीज़ वर्तमान मानदंडों के अनुसार PM-JAY योजना के लिए सीधे पात्र नहीं पाया गया। राज्य स्वास्थ्य योजना की जाँच करें।",
      ashaGuidance: eligible
        ? "आशा दीदी के लिए निर्देश: मरीज़ का राशन कार्ड या आधार कार्ड अस्पताल के 'आयुष्मान मित्र' काउंटर पर जमा करवाएं ताकि तुरंत ई-कार्ड और निःशुल्क दवाइयां मिल सकें।"
        : "आशा दीदी के लिए निर्देश: मरीज़ को नज़दीकी प्राथमिक स्वास्थ्य केंद्र (PHC) या जन सेवा केंद्र में ले जाकर पात्रता सूची में नाम चेक करवाएं।"
    };
  }

  return {
    eligible,
    schemeName: "Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana (AB PM-JAY)",
    coverageAmount: eligible ? "₹5,00,000 / year (per family)" : "₹0",
    beneficiaryCategory: isLowIncome ? "SECC Deprivation / BPL Ration Beneficiary" : "Senior Citizen Emergency Care Entitlement",
    claimPreAuthStatus: claimStatus,
    eligibleProcedures: matchedPackages,
    empanelledHospitalNotice: "This hospital is empanelled under AB PM-JAY. The patient is entitled to 100% cashless hospitalization.",
    copayRequirement: "Zero Out-of-Pocket Expense (100% Cashless Treatment)",
    nationalHelpline: "14555 / 1800-111-565 (Toll-Free 24x7)",
    rationale: eligible
      ? `Patient qualifies under PM-JAY national health protection mandate based on clinical acuity (${patient.admissionType || "Emergency"}) and demographic vulnerability.`
      : "Patient does not meet automatic PM-JAY pre-authorization. Recommend verification at the hospital Ayushman Mitra desk.",
    ashaGuidance: eligible
      ? "ASHA Worker Action: Escort patient/family to the hospital 'Ayushman Mitra' kiosk with Aadhaar or Ration Card to initiate Golden Card cashless pre-auth."
      : "ASHA Worker Action: Assist family in checking state-level welfare schemes (e.g. state health insurance) at the local Common Service Centre (CSC)."
  };
}
