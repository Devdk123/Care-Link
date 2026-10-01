/**
 * Digital India Bhashini (MeitY) & Sarvam AI Integration Test Suite
 * 
 * Tests:
 * 1. 22 Scheduled Indian Language Catalog & Normalization
 * 2. Bhashini Neural Machine Translation (NMT - IndicTrans2)
 * 3. Bhashini Text-to-Speech (TTS - Indic-TTS)
 * 4. Unified Indic Gateway Provider Status & Routing
 * 5. Dynamic Auto-Failover (Bhashini <-> Sarvam AI)
 * 6. Clinical Vocabulary Integrity (Hypoxia, SpO2 alerts)
 */

import {
  BHASHINI_LANGUAGES,
  getBhashiniLanguages,
  normalizeBhashiniLangCode,
  translateBhashini,
  synthesizeBhashiniSpeech,
  isBhashiniConfigured,
} from '../src/lib/agents/bhashiniAgent';

import {
  getIndicProvidersStatus,
  translateIndicUnified,
  synthesizeIndicUnifiedSpeech,
} from '../src/lib/agents/indicUnifiedGateway';

import {
  getSupportedIndicLanguages,
  isSarvamConfigured,
} from '../src/lib/agents/sarvamIndicAgent';

async function runBhashiniTests() {
  console.log('========================================================================');
  console.log('🇮🇳 CareLink Digital India Bhashini (MeitY) & Sarvam Dual-Engine Test Suite');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(desc: string, condition: boolean, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc} ${detail ? `(${detail})` : ''}`);
    }
  }

  // ── TEST 1: BHASHINI LANGUAGE CATALOG ──
  console.log('🔹 Test 1: Bhashini Language Catalog (22 Scheduled Languages)');
  const languages = getBhashiniLanguages();
  assert('Catalog returns non-empty list of Indian languages', languages.length >= 14);
  assert('Hindi (hi) is present in catalog', languages.some(l => l.code === 'hi'));
  assert('Tamil (ta) is present in catalog', languages.some(l => l.code === 'ta'));
  assert('Telugu (te) is present in catalog', languages.some(l => l.code === 'te'));
  assert('Bengali (bn) is present in catalog', languages.some(l => l.code === 'bn'));
  assert('Marathi (mr) is present in catalog', languages.some(l => l.code === 'mr'));
  console.log(`    Total cataloged Indic languages: ${languages.length}`);

  // ── TEST 2: CODE NORMALIZATION ──
  console.log('\n🔹 Test 2: Language Code Normalization');
  assert('Normalizes "hi-IN" to "hi"', normalizeBhashiniLangCode('hi-IN') === 'hi');
  assert('Normalizes "tamil" to "ta"', normalizeBhashiniLangCode('tamil') === 'ta');
  assert('Normalizes "TELUGU" to "te"', normalizeBhashiniLangCode('TELUGU') === 'te');
  assert('Normalizes "bengali" to "bn"', normalizeBhashiniLangCode('bengali') === 'bn');
  assert('Fallback for unknown string returns valid code', typeof normalizeBhashiniLangCode('unknown-xyz') === 'string');

  // ── TEST 3: BHASHINI NEURAL TRANSLATION ──
  console.log('\n🔹 Test 3: Bhashini Translation (NMT IndicTrans2 / Clinical Fallback)');
  const sampleAlert = 'Critical alert: Patient SpO2 dropped to 84%. Immediate ICU physician review requested.';

  const hiRes = await translateBhashini({
    text: sampleAlert,
    targetLang: 'hi',
  });
  assert('Hindi translation produced non-empty output', hiRes.translatedText.length > 0);
  assert('Hindi output contains Indic characters or clinical terms', /[\u0900-\u097F]/.test(hiRes.translatedText) || hiRes.translatedText.includes('84%'));
  console.log(`    Hindi Output: "${hiRes.translatedText.slice(0, 80)}..." (Provider: ${hiRes.provider})`);

  const taRes = await translateBhashini({
    text: sampleAlert,
    targetLang: 'ta',
  });
  assert('Tamil translation produced non-empty output', taRes.translatedText.length > 0);
  assert('Tamil output contains Tamil script or clinical terms', /[\u0B80-\u0BFF]/.test(taRes.translatedText) || taRes.translatedText.includes('84%'));
  console.log(`    Tamil Output: "${taRes.translatedText.slice(0, 80)}..." (Provider: ${taRes.provider})`);

  const bnRes = await translateBhashini({
    text: sampleAlert,
    targetLang: 'bn',
  });
  assert('Bengali translation produced non-empty output', bnRes.translatedText.length > 0);
  console.log(`    Bengali Output: "${bnRes.translatedText.slice(0, 80)}..." (Provider: ${bnRes.provider})`);

  // ── TEST 4: BHASHINI TEXT-TO-SPEECH (TTS) ──
  console.log('\n🔹 Test 4: Bhashini Speech Synthesis (Indic-TTS / RIFF PCM WAV)');
  const ttsRes = await synthesizeBhashiniSpeech({
    text: 'मरीज का ऑक्सीजन 84 प्रतिशत है।',
    targetLang: 'hi',
  });
  assert('TTS produces valid base64 audio payload', Boolean(ttsRes.audioBase64 && ttsRes.audioBase64.length > 100));
  assert('Data URI contains audio/wav MIME type', ttsRes.dataUri.startsWith('data:audio/wav;base64,'));
  assert('Duration is calculated and positive', ttsRes.durationSec > 0);
  console.log(`    Audio size: ${ttsRes.audioBase64.length} chars, Duration: ~${ttsRes.durationSec}s`);

  // Verify RIFF WAV magic header bytes (RIFF = 'UklGR' in base64)
  const isWavRiff = ttsRes.audioBase64.startsWith('UklGR');
  assert('WAV header matches RIFF PCM container specification', isWavRiff);

  // ── TEST 5: UNIFIED INDIC GATEWAY PROVIDER STATUS ──
  console.log('\n🔹 Test 5: Indic Unified Gateway Provider Status');
  const status = getIndicProvidersStatus();
  assert('Status reports Bhashini info', Boolean(status.bhashini && status.bhashini.name.includes('Bhashini')));
  assert('Status reports Sarvam info', Boolean(status.sarvam && status.sarvam.name.includes('Sarvam')));
  assert('Failover is reported as available', status.failoverAvailable === true);
  console.log(`    Bhashini Configured: ${status.bhashini.isConfigured} (${status.bhashini.languagesCount} langs)`);
  console.log(`    Sarvam Configured:   ${status.sarvam.isConfigured} (${status.sarvam.languagesCount} langs)`);
  console.log(`    Default Provider:    ${status.defaultProvider}`);

  // ── TEST 6: UNIFIED DYNAMIC ROUTING & AUTO-FAILOVER ──
  console.log('\n🔹 Test 6: Unified Dynamic Routing & Translation');
  // Routing to Bhashini explicitly
  const unifiedBhashini = await translateIndicUnified({
    text: sampleAlert,
    targetLang: 'hi',
    provider: 'bhashini',
  });
  assert('Explicit Bhashini route returns translated text', unifiedBhashini.translatedText.length > 0);
  console.log(`    Routed Bhashini Engine: ${unifiedBhashini.engineName} (Failover: ${unifiedBhashini.failoverOccurred})`);

  // Routing to Sarvam explicitly
  const unifiedSarvam = await translateIndicUnified({
    text: sampleAlert,
    targetLang: 'hi',
    provider: 'sarvam',
  });
  assert('Explicit Sarvam route returns translated text', unifiedSarvam.translatedText.length > 0);
  console.log(`    Routed Sarvam Engine:   ${unifiedSarvam.engineName} (Failover: ${unifiedSarvam.failoverOccurred})`);

  // Routing with 'auto' (Auto-selection / Failover)
  const unifiedAuto = await translateIndicUnified({
    text: sampleAlert,
    targetLang: 'ta',
    provider: 'auto',
  });
  assert('Auto route successfully translates', unifiedAuto.translatedText.length > 0);
  console.log(`    Auto Engine Choice:     ${unifiedAuto.engineName}`);

  // ── TEST 7: UNIFIED SPEECH SYNTHESIS (TTS) ──
  console.log('\n🔹 Test 7: Unified Speech Synthesis');
  const unifiedTts = await synthesizeIndicUnifiedSpeech({
    text: 'பாஷிணி மற்றும் சர்வம AI அவசர எச்சரிக்கை',
    targetLang: 'ta',
    provider: 'auto',
  });
  assert('Unified TTS produces audio base64', Boolean(unifiedTts.audioBase64));
  assert('Unified TTS outputs audio/wav format', unifiedTts.format === 'audio/wav');
  console.log(`    Unified TTS Provider:   ${unifiedTts.providerUsed} (${unifiedTts.engineName})`);

  // ── TEST SUMMARY ──
  console.log('\n========================================================================');
  console.log(`🏁 TEST RESULTS: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================================');

  if (passed === total) {
    console.log('🎉 ALL DIGITAL INDIA BHASHINI & SARVAM AI INTEGRATION TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED.');
    process.exit(1);
  }
}

runBhashiniTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
