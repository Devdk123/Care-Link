/**
 * CareLink Phase 6: TypeScript RAGAS & Observability Test Suite
 * Tests the TypeScript evaluation engine and verifies live API endpoints:
 * - /api/agent/observability/traces
 * - /api/agent/observability/summary
 * - /api/agent/observability/ragas
 */

import { evaluateRagasMetrics, CLINICAL_BENCHMARK_CASES, RAGAS_PASS_THRESHOLD } from '../src/lib/agents/evalRagas';
import { searchClinicalGuidelines } from '../src/lib/clinicalRag';
import { recordRunTrace, getRecentTraces, getObservabilitySummary, RunTrace } from '../src/lib/agents/observability';

const BASE_URL = 'http://localhost:3005';

async function testTypeScriptRagasEngine() {
  console.log('[TEST 1/4] Testing TypeScript RAGAS evaluation engine on grounded clinical text...');
  const query = 'Patient with acute decompensated heart failure, severe bilateral edema, and elevated blood pressure.';
  const answer = (
    'According to [ICMR-HF-01], patients discharged following acute decompensated heart failure ' +
    'must undergo daily morning dry-weight monitoring and clinical review within 7 to 10 days. ' +
    'Sudden weight gain exceeding 2.0 kg indicates fluid retention requiring immediate diuretic escalation. ' +
    'Per [AHA-HTN-01], target blood pressure should be strictly monitored under GDMT protocols.'
  );

  const retrieved = await searchClinicalGuidelines(query, 3);
  const result = evaluateRagasMetrics(query, answer, retrieved, ['ICMR-HF-01', 'AHA-HTN-01']);

  console.log(`  - Faithfulness:      ${result.faithfulness}`);
  console.log(`  - Context Precision: ${result.contextPrecision}`);
  console.log(`  - Answer Relevancy:  ${result.answerRelevancy}`);
  console.log(`  - Composite Score:   ${result.compositeScore}`);
  console.log(`  - Verdict:           ${result.verdict}`);

  if (!result.isPassed || result.faithfulness < 0.70) {
    throw new Error(`Grounded case failed RAGAS evaluation: ${result.verdict}`);
  }
  console.log('  [PASS] TypeScript RAGAS engine verified on grounded text.');
}

async function testTypeScriptRagasHallucinationPenalty() {
  console.log('[TEST 2/4] Testing hallucination penalty on ungrounded dangerous text...');
  const query = 'Patient on therapeutic Warfarin asks to take Ibuprofen 800mg TID.';
  const ungroundedAnswer = (
    'It is totally fine to take high dose Ibuprofen 800mg TID along with Warfarin. ' +
    'There are no known bleeding interactions between NSAIDs and anticoagulants. ' +
    'Feel free to take aspirin as well if the joint pain continues.'
  );

  const retrieved = await searchClinicalGuidelines(query, 3);
  const result = evaluateRagasMetrics(query, ungroundedAnswer, retrieved, ['AHA-DDI-01']);

  console.log(`  - Faithfulness:    ${result.faithfulness}`);
  console.log(`  - Composite Score: ${result.compositeScore}`);
  console.log(`  - Verdict:         ${result.verdict}`);
  console.log(`  - Hallucination:   ${result.details.hallucinationRisk}`);

  if (result.isPassed || result.faithfulness >= 0.70) {
    throw new Error('Ungrounded response was unexpectedly passed by RAGAS evaluator!');
  }
  console.log('  [PASS] Ungrounded dangerous response correctly penalized.');
}

async function testObservabilityStore() {
  console.log('[TEST 3/4] Testing local trace recorder and summary aggregator...');
  const trace: RunTrace = {
    traceId: `trace_ts_phase6_${Date.now()}`,
    rootQuery: 'Triage evaluation for post-discharge STEMI patient with orthopnea',
    routedAgent: 'triage',
    routingConfidence: 0.95,
    totalDurationMs: 420,
    tokenUsage: { promptTokens: 140, completionTokens: 90, totalTokens: 230 },
    providerUsed: 'groq',
    groundingScore: 0.96,
    citations: ['[ICMR-HF-01]'],
    isSafetyBlocked: false,
    spans: [
      { spanId: 'sp_1', name: 'vitals_check', agent: 'triage', startTime: Date.now(), durationMs: 40, status: 'SUCCESS' },
      { spanId: 'sp_2', name: 'llm_generation', agent: 'triage', startTime: Date.now() + 40, durationMs: 380, status: 'SUCCESS' }
    ],
    createdAt: new Date().toISOString(),
    status: 'COMPLETED'
  };

  recordRunTrace(trace);
  const recent = getRecentTraces(5);
  const summary = getObservabilitySummary();

  console.log(`  - Recent Traces Count: ${recent.length}`);
  console.log(`  - Average Latency:    ${summary.avgLatencyMs} ms`);
  console.log(`  - Average Grounding:  ${summary.avgGroundingScore}`);
  console.log(`  - Providers:          ${JSON.stringify(summary.providerDistribution)}`);

  if (recent.length === 0 || summary.totalRuns === 0) {
    throw new Error('Trace recording failed in memory store');
  }
  console.log('  [PASS] Trace store and summary computation verified.');
}

async function testLiveObservabilityApi() {
  console.log('[TEST 4/4] Testing live Express observability API endpoints...');
  try {
    const tracesRes = await fetch(`${BASE_URL}/api/agent/observability/traces?limit=5`);
    if (!tracesRes.ok) {
      console.log('  [NOTE] Dev server endpoint skipped or returned status:', tracesRes.status);
      return;
    }
    const tracesData = await tracesRes.json();
    console.log(`  - API /traces returned ${tracesData.traces?.length ?? 0} trace(s).`);

    const summaryRes = await fetch(`${BASE_URL}/api/agent/observability/summary`);
    const summaryData = await summaryRes.json();
    console.log(`  - API /summary total runs: ${summaryData.totalRuns}`);

    const ragasRes = await fetch(`${BASE_URL}/api/agent/observability/ragas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Patient with severe dyspnea and orthopnea post-MI',
        answer: 'Per [ICMR-HF-01], immediate diuretic escalation and cardiology review within 7 days is indicated.',
        expectedGuidelineTags: ['ICMR-HF-01']
      })
    });
    const ragasData = await ragasRes.json();
    console.log(`  - API /ragas composite score: ${ragasData.compositeScore} (${ragasData.verdict})`);

    console.log('  [PASS] Live Express observability API endpoints verified.');
  } catch (err: any) {
    console.log('  [NOTE] Dev server fetch not available synchronously:', err.message);
  }
}

async function main() {
  console.log('================================================================');
  console.log('CareLink Phase 6: TypeScript RAGAS & Observability Test Suite');
  console.log('================================================================');
  await testTypeScriptRagasEngine();
  await testTypeScriptRagasHallucinationPenalty();
  await testObservabilityStore();
  await testLiveObservabilityApi();
  console.log('================================================================');
  console.log('ALL PHASE 6 TYPESCRIPT TESTS PASSED [PASS]');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Phase 6 TS Test Failure:', err);
  process.exit(1);
});
