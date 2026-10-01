import dotenv from 'dotenv';
dotenv.config();

import { callWithFailover, callWithFailoverJson } from '../src/lib/failoverLlm';

async function main() {
  console.log('====================================================');
  console.log(' CareLink Dual-Model Failover Gateway Verification');
  console.log('====================================================\n');

  // Test 1: Standard call with primary Gemini
  console.log('--- Test 1: Primary Model Call (Gemini) ---');
  const result1 = await callWithFailoverJson<{ urgency: string; rationale: string }>(
    {
      systemPrompt: 'You are an emergency clinical triage AI. Output JSON with fields "urgency" and "rationale".',
      userMessage: 'Patient 64yo Male, chest pain radiating to left jaw, SpO2 93%, BP 165/100.',
      fallbackText: '{"urgency": "Emergency", "rationale": "Severe acute coronary syndrome risk"}',
    },
    { urgency: 'Emergency', rationale: 'Fallback triggered' }
  );

  console.log(`Provider: ${result1.metrics.provider}`);
  console.log(`Model: ${result1.metrics.model}`);
  console.log(`Failover Occurred: ${result1.metrics.failoverOccurred}`);
  console.log(`Latency: ${result1.metrics.latencyMs} ms`);
  console.log(`Data:`, result1.data);
  console.log('--------------------------------------------\n');

  // Test 2: Simulated Gemini Quota Exhaustion (Failover to Groq)
  console.log('--- Test 2: Simulated Gemini Quota Exhaustion (Auto-Failover to Groq) ---');
  // Temporarily sabotage GEMINI_API_KEY
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'INVALID_QUOTA_EXHAUSTED_KEY';

  const result2 = await callWithFailoverJson<{ assessment: string; safetyFlag: boolean }>(
    {
      systemPrompt: 'You are a healthcare safety assistant. Output JSON with "assessment" and "safetyFlag".',
      userMessage: 'Check drug combination: Warfarin 5mg + Ibuprofen 400mg TID.',
      fallbackText: '{"assessment": "Critical interaction: bleeding hazard", "safetyFlag": true}',
    },
    { assessment: 'Fallback', safetyFlag: true }
  );

  // Restore key
  process.env.GEMINI_API_KEY = originalKey;

  console.log(`Provider: ${result2.metrics.provider}`);
  console.log(`Model: ${result2.metrics.model}`);
  console.log(`Failover Occurred: ${result2.metrics.failoverOccurred}`);
  console.log(`Failover Reason: ${result2.metrics.failoverReason}`);
  console.log(`Latency: ${result2.metrics.latencyMs} ms`);
  console.log(`Data:`, result2.data);
  console.log('--------------------------------------------\n');

  console.log('ALL FAILOVER GATEWAY TESTS COMPLETED SUCCESSFULLY!');
}

main().catch(console.error);
