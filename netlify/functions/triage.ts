import { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface PatientVitals {
  bloodPressure: string;
  heartRate: number;
  temperature: number;
  oxygenSaturation: number;
}

interface PatientObject {
  id: string;
  name: string;
  age: number;
  gender: string;
  condition: string;
  vitals: PatientVitals;
  medications: string[];
  lastVisit: string;
  riskScore?: number;
  riskTier?: "Low" | "Medium" | "High";
  notes?: string;
}

interface TriageResult {
  urgencyLevel: "IMMEDIATE" | "URGENT" | "SEMI-URGENT" | "NON-URGENT";
  clinicalSummary: string;
  primaryConcerns: string[];
  recommendedActions: string[];
  estimatedWaitTime: string;
  redFlags: string[];
  confidence: number;
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Fallback logic for rule-based urgency assessment
function getRuleBasedFallback(patient: PatientObject): TriageResult {
  const { vitals, riskTier } = patient;
  let urgencyLevel: TriageResult["urgencyLevel"] = "NON-URGENT";

  if (vitals.oxygenSaturation < 92 || vitals.heartRate > 120 || vitals.heartRate < 50) {
    urgencyLevel = "IMMEDIATE";
  } else if (riskTier === "High" || vitals.temperature > 103) {
    urgencyLevel = "URGENT";
  } else if (riskTier === "Medium") {
    urgencyLevel = "SEMI-URGENT";
  }

  return {
    urgencyLevel,
    clinicalSummary: `Fallback rule-based assessment due to AI service disruption. Patient assigned ${urgencyLevel} priority.`,
    primaryConcerns: ["System fallback triggered", "Requires manual clinical review"],
    recommendedActions: ["Physician to evaluate patient manually", "Verify vitals"],
    estimatedWaitTime: urgencyLevel === "IMMEDIATE" ? "Immediate" : urgencyLevel === "URGENT" ? "< 15 minutes" : "< 60 minutes",
    redFlags: ["Fallback assessment only"],
    confidence: 0.5,
  };
}

export const handler: Handler = async (event) => {
  // Handle CORS OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: 'OK',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    if (!event.body) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Empty request body' }) };
    }

    const patient: PatientObject = JSON.parse(event.body);

    if (!patient.name || !patient.vitals) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid payload: missing name or vitals' }),
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY environment variable is missing");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Internal Server Error: AI configuration missing' }),
      };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      const prompt = `
        You are an expert clinical triage AI for CareLink EHR. 
        Review the following patient data and generate a triage assessment.
        
        Respond ONLY with a valid JSON object matching this exact structure, with no markdown formatting or extra text:
        {
          "urgencyLevel": "IMMEDIATE" | "URGENT" | "SEMI-URGENT" | "NON-URGENT",
          "clinicalSummary": "string (2-3 sentences, plain English)",
          "primaryConcerns": ["string (top 3 bullet points)"],
          "recommendedActions": ["string (specific next steps)"],
          "estimatedWaitTime": "string (e.g. '< 15 minutes')",
          "redFlags": ["string (warning signs to monitor)"],
          "confidence": number (0.0 to 1.0)
        }

        Patient Data:
        ${JSON.stringify(patient, null, 2)}
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      let parsedTriage: TriageResult;
      try {
        // Strip markdown blocks if the model ignores the responseMimeType
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedTriage = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.error("Failed to parse Gemini response as JSON. Falling back.", parseErr, responseText);
        parsedTriage = getRuleBasedFallback(patient);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(parsedTriage),
      };

    } catch (aiError) {
      console.error("Gemini API Error:", aiError);
      // Fallback on API failure
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(getRuleBasedFallback(patient)),
      };
    }

  } catch (error) {
    console.error("Unexpected error in triage handler:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
