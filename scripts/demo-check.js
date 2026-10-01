import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars manually without external dependencies like dotenv
const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  const envFile = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#\s][^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  });
} catch (e) {
  // If .env is missing, rely on system process.env
}

// Colors for terminal
const C_GREEN = '\x1b[32m';
const C_RED = '\x1b[31m';
const C_BLUE = '\x1b[34m';
const C_YELLOW = '\x1b[33m';
const C_RESET = '\x1b[0m';

let checksPassed = 0;
const TOTAL_CHECKS = 5;

// Custom fetch wrapper with a 5-second timeout
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function runChecks() {
  console.log(`\n${C_BLUE}==========================================${C_RESET}`);
  console.log(`${C_BLUE}   CareLink Pre-Demo Health Check Suite   ${C_RESET}`);
  console.log(`${C_BLUE}==========================================${C_RESET}\n`);

  // 1. ENVIRONMENT CHECK
  const requiredVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'GEMINI_API_KEY', 'VITE_ML_API_URL'];
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  if (missingVars.length === 0) {
    console.log(`${C_GREEN}■ ENV OK${C_RESET}`);
    checksPassed++;
  } else {
    console.log(`${C_RED}■ Missing ENV: [${missingVars.join(', ')}]${C_RESET}`);
  }

  // 2. SUPABASE CHECK
  try {
    if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
      throw new Error("Skipping Supabase check due to missing env vars");
    }
    const sbUrl = `${process.env.VITE_SUPABASE_URL}/rest/v1/patients?select=*`;
    const res = await fetchWithTimeout(sbUrl, {
      headers: {
        'apikey': process.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length < 3) {
      throw new Error(`Insufficient patients in DB (found ${data.length || 0})`);
    }
    console.log(`${C_GREEN}■ Supabase: ${data.length} patients ready${C_RESET}`);
    checksPassed++;
  } catch (err) {
    console.log(`${C_RED}■ Supabase Check Failed: ${err.message}${C_RESET}`);
  }

  // 3. ML BACKEND CHECK
  try {
    if (!process.env.VITE_ML_API_URL) throw new Error("Skipping ML Backend due to missing env vars");
    
    // Check root / status
    const resRoot = await fetchWithTimeout(`${process.env.VITE_ML_API_URL}/`);
    if (!resRoot.ok) throw new Error(`Backend / returned ${resRoot.status}`);
    const dataRoot = await resRoot.json();
    if (dataRoot.status !== "online") throw new Error(`Backend not online: ${dataRoot.status}`);
    
    // Check /patients
    const resPatients = await fetchWithTimeout(`${process.env.VITE_ML_API_URL}/patients`);
    const dataPatients = await resPatients.json();
    if (!Array.isArray(dataPatients) || dataPatients.length === 0) throw new Error(`No patients from ML backend`);
    
    // Check /predict/1 (or use the first patient ID found)
    const testPatientId = dataPatients[0].patient_id;
    const resPredict = await fetchWithTimeout(`${process.env.VITE_ML_API_URL}/predict/${testPatientId}`);
    const dataPredict = await resPredict.json();
    if (!("probability" in dataPredict && "risk_tier" in dataPredict && "top_factors" in dataPredict)) {
      throw new Error(`Missing expected fields in prediction response`);
    }

    console.log(`${C_GREEN}■ ML Backend: AUC model loaded, threshold ${dataRoot.threshold || 'optimal'}${C_RESET}`);
    checksPassed++;
  } catch (err) {
    console.log(`${C_RED}■ ML Backend Check Failed: ${err.message}${C_RESET}`);
  }

  // 4. NETLIFY TRIAGE CHECK
  try {
    const triageUrl = "http://localhost:8888/.netlify/functions/triage";
    const payload = {
      patient: {
        name: "Test Patient",
        age: 70,
        gender: "M",
        vitals: { bloodPressure: "140/90", heartRate: 95, temperature: 98.6, oxygenSaturation: 96 }
      }
    };
    const resTriage = await fetchWithTimeout(triageUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resTriage.ok) throw new Error(`Netlify function returned HTTP ${resTriage.status}`);
    
    const dataTriage = await resTriage.json();
    if (!dataTriage.urgencyLevel) throw new Error("Response missing urgencyLevel field");
    
    console.log(`${C_GREEN}■ Gemini Triage: ${dataTriage.urgencyLevel}${C_RESET}`);
    checksPassed++;
  } catch (err) {
    console.log(`${C_RED}■ Netlify Triage Check Failed: ${err.message}${C_RESET}`);
  }

  // 5. FRONTEND CHECK
  try {
    const feUrl = "http://localhost:5173";
    const resFe = await fetchWithTimeout(feUrl);
    if (!resFe.ok) throw new Error(`Frontend returned HTTP ${resFe.status}`);
    console.log(`${C_GREEN}■ Frontend: Live at ${feUrl}${C_RESET}`);
    checksPassed++;
  } catch (err) {
    console.log(`${C_RED}■ Frontend Check Failed: ${err.message}${C_RESET}`);
  }

  // 6. SUMMARY
  console.log(`\n------------------------------------------`);
  if (checksPassed === TOTAL_CHECKS) {
    console.log(`${C_GREEN}■ ${checksPassed}/${TOTAL_CHECKS} checks passed.${C_RESET}`);
    console.log(`${C_GREEN}■ DEMO READY — Go win that hackathon!${C_RESET}`);
    process.exit(0);
  } else {
    console.log(`${C_YELLOW}■ ${checksPassed}/${TOTAL_CHECKS} checks passed.${C_RESET}`);
    console.log(`${C_RED}■■ Fix issues above before presenting.${C_RESET}`);
    process.exit(1);
  }
}

runChecks();
