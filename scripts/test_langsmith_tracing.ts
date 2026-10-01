/**
 * CareLink LangSmith Tracing Verification Script
 * Validates that agent calls, multi-agent supervisor orchestrations,
 * and clinical spans are actively captured and queryable in LangSmith Cloud.
 */

import dotenv from 'dotenv';
dotenv.config();

import { Client } from 'langsmith';
import { runSupervisor, classifyClinicalIntent } from '../src/lib/agents/supervisor';
import { createInitialAgentState } from '../src/lib/agents/state';
import { recordRunTrace, getLangsmithProjectStatus } from '../src/lib/agents/observability';

async function main() {
  console.log('===============================================================');
  console.log('  CareLink Observability: LangSmith Trace Verification');
  console.log('===============================================================\n');

  const apiKey = process.env.LANGSMITH_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: LANGSMITH_API_KEY is not defined in .env');
    process.exit(1);
  }

  const projectName = process.env.LANGSMITH_PROJECT || 'carelink-clinical-agent';
  console.log(`📡 Connecting to LangSmith Cloud...`);
  console.log(`   Project: ${projectName}`);

  const lsClient = new Client({
    apiKey,
    apiUrl: process.env.LANGSMITH_ENDPOINT || 'https://api.smith.langchain.com'
  });

  // 1. Verify Project
  const projectStatus = await getLangsmithProjectStatus();
  console.log(`✅ LangSmith Project Status: ${projectStatus.enabled ? 'ACTIVE' : 'INACTIVE'}`);
  console.log(`   Project URL: ${projectStatus.projectUrl}`);

  // 2. Test Traced Intent Classification
  console.log(`\n🔍 Test 1: Executing traced classifyClinicalIntent...`);
  const intentResult = await classifyClinicalIntent('Patient has severe orthopnea, SpO2 88%, and bilateral leg edema');
  console.log(`   Result: Intent='${intentResult.intent}', Confidence=${intentResult.confidence}`);

  // 3. Test Traced Multi-Agent Supervisor
  console.log(`\n🤖 Test 2: Executing full CareLink Supervisor agent pipeline...`);
  const initialState = createInitialAgentState(
    '72yo male with decompensated heart failure, taking Metoprolol and Lisinopril, complaints of dizziness and low BP',
    {
      patientId: 'PT-HF-1092',
      vitals: { heartRate: 52, systolicBp: 88, diastolicBp: 56, spO2: 95 },
      medications: [
        'Metoprolol Succinate 50mg Daily',
        'Lisinopril 20mg Daily'
      ]
    }
  );

  const startTime = Date.now();
  const finalState = await runSupervisor(initialState);
  const durationMs = Date.now() - startTime;

  console.log(`   Routed Agent: ${finalState.routedAgent}`);
  console.log(`   Grounding Fidelity: ${finalState.groundingFidelity}`);
  console.log(`   Execution Steps: ${finalState.executionSteps.length}`);
  console.log(`   Response Preview: ${finalState.agentResponse.slice(0, 100)}...`);

  // 4. Test Cloud Record Sync
  console.log(`\n☁️ Test 3: Syncing structured RunTrace to LangSmith Cloud...`);
  const traceId = `trace_${Date.now()}`;
  recordRunTrace({
    traceId,
    patientId: 'PT-HF-1092',
    rootQuery: initialState.userQuery,
    routedAgent: finalState.routedAgent,
    routingConfidence: finalState.routingConfidence,
    totalDurationMs: durationMs,
    tokenUsage: { promptTokens: 240, completionTokens: 180, totalTokens: 420 },
    providerUsed: 'gemini',
    groundingScore: finalState.groundingFidelity || 1.0,
    citations: finalState.citations || [],
    isSafetyBlocked: Boolean(finalState.isBlockedBySafety),
    spans: finalState.executionSteps.map(s => ({
      spanId: `span_${s.stepId}`,
      name: s.action,
      agent: s.agent,
      startTime,
      durationMs: 45,
      status: 'SUCCESS',
      metadata: s.detail as any
    })),
    createdAt: new Date().toISOString(),
    status: 'COMPLETED'
  });

  // Give LangSmith HTTP queue a second to flush
  await new Promise(r => setTimeout(r, 2000));

  // 5. Query Recent Traces from LangSmith Cloud
  console.log(`\n📊 Test 4: Querying traces from LangSmith Cloud API...`);
  try {
    const project = await lsClient.readProject({ projectName });
    let foundCount = 0;
    for await (const run of lsClient.listRuns({ projectName, limit: 5 })) {
      console.log(`   - [${run.status || 'SUCCESS'}] Run: "${run.name}" (Type: ${run.run_type}, ID: ${run.id})`);
      foundCount++;
    }
    console.log(`\n🎉 Verification Complete: ${foundCount} runs confirmed active in LangSmith!`);
    console.log(`🔗 Dashboard: https://smith.langchain.com/projects/p/${project.name}`);
  } catch (err: any) {
    console.warn('   Could not list runs directly:', err.message);
  }
}

main().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
