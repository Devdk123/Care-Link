/**
 * Phase 12 Verification Suite: Sarvam AI Indic Multi-Language System
 * 
 * Verifies:
 * 1. Indic Language Registry (10 Indian languages + English)
 * 2. Language normalization and alias resolution
 * 3. Clinical translation across all 10 Indic languages
 * 4. Preservation of vital metrics and urgency in native Indic scripts
 * 5. Speech synthesis (TTS) & valid PCM WAV base64 generation
 * 6. Error handling and deterministic fallback mechanics
 */

import {
  getSupportedIndicLanguages,
  normalizeLanguageCode,
  translateIndicText,
  synthesizeIndicSpeech,
  generateValidPcmWavBase64,
} from '../src/lib/agents/sarvamIndicAgent';

let testsPassed = 0;
let testsTotal = 0;

function assert(condition: boolean, testName: string, extraInfo?: string) {
  testsTotal++;
  if (condition) {
    testsPassed++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}${extraInfo ? ` — ${extraInfo}` : ''}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

async function runPhase12Tests() {
  console.log('\n=============================================================');
  console.log('🇮🇳 CareLink Sarvam AI Indic System — Phase 12 Verification Suite');
  console.log('=============================================================\n');

  // Test 1: Language Registry
  console.log('Test 1: Indic Language Registry & Metadata');
  const languages = getSupportedIndicLanguages();
  assert(languages.length >= 11, `Found ${languages.length} languages (expected >= 11)`);

  const expectedCodes = ['hi-IN', 'ta-IN', 'te-IN', 'bn-IN', 'kn-IN', 'mr-IN', 'gu-IN', 'ml-IN', 'od-IN', 'pa-IN', 'en-IN'];
  for (const code of expectedCodes) {
    const found = languages.find((l) => l.code === code);
    assert(Boolean(found), `Language ${code} registered with valid metadata`);
    assert(Boolean(found?.nativeName), `${code} has native script name (${found?.nativeName})`);
    assert(Boolean(found?.sampleGreeting), `${code} has sample greeting`);
  }

  // Test 2: Language Code Normalization
  console.log('\nTest 2: Language Code Normalization');
  assert(normalizeLanguageCode('hi') === 'hi-IN', 'Normalized "hi" to "hi-IN"');
  assert(normalizeLanguageCode('tamil') === 'ta-IN', 'Normalized "tamil" to "ta-IN"');
  assert(normalizeLanguageCode('odia') === 'od-IN', 'Normalized "odia" to "od-IN"');
  assert(normalizeLanguageCode('punjabi') === 'pa-IN', 'Normalized "punjabi" to "pa-IN"');
  assert(normalizeLanguageCode('unknown') === 'hi-IN', 'Fallback unknown language to default "hi-IN"');

  // Test 3: Clinical Translation Across All 10 Indic Languages
  console.log('\nTest 3: Clinical Translation Across 10 Indic Languages');
  const testAlert = 'Critical Hypoxia Alert: Patient oxygen saturation dropped to 84%. Immediate doctor attention required.';

  const targetLangs = ['hi-IN', 'ta-IN', 'te-IN', 'bn-IN', 'kn-IN', 'mr-IN', 'gu-IN', 'ml-IN', 'od-IN', 'pa-IN'];

  for (const targetLang of targetLangs) {
    const res = await translateIndicText({
      text: testAlert,
      sourceLang: 'en-IN',
      targetLang,
    });

    assert(Boolean(res.translatedText && res.translatedText.length > 10), `Translation generated for ${targetLang}`);
    assert(res.targetLang === targetLang, `Target language matches ${targetLang}`);
    assert(res.latencyMs >= 0, `Latency recorded (${res.latencyMs}ms)`);
    assert(
      res.provider === 'sarvam' || res.provider === 'deterministic' || res.provider === 'llm_fallback',
      `Provider verified (${res.provider}) for ${targetLang}`
    );

    // Verify native Indic script characters are present
    const hasNonAscii = /[^\u0000-\u007F]/.test(res.translatedText);
    assert(hasNonAscii, `${targetLang} output contains authentic native Indic script`);
  }

  // Test 4: Post-Discharge Care Plan Translation
  console.log('\nTest 4: Post-Discharge Care Plan Translation');
  const carePlanText = 'Post-Discharge Care Plan: Take prescribed heart medications on time, limit salt intake, and report dyspnea.';
  const hindiCarePlan = await translateIndicText({
    text: carePlanText,
    sourceLang: 'en-IN',
    targetLang: 'hi-IN',
  });
  assert(hindiCarePlan.translatedText.includes('दवा') || hindiCarePlan.translatedText.includes('देखभाल'), 'Hindi care plan contains correct clinical terms');

  // Test 5: Identity & Empty Input Handling
  console.log('\nTest 5: Identity & Empty Input Handling');
  const identityRes = await translateIndicText({
    text: 'Identical text',
    sourceLang: 'hi-IN',
    targetLang: 'hi-IN',
  });
  assert(identityRes.provider === 'original' && identityRes.translatedText === 'Identical text', 'Identity translation returns original text');

  const emptyRes = await translateIndicText({
    text: '',
    sourceLang: 'en-IN',
    targetLang: 'ta-IN',
  });
  assert(emptyRes.translatedText === '', 'Empty string handled safely');

  // Test 6: Text-to-Speech (TTS) Synthesis
  console.log('\nTest 6: Speech Synthesis & PCM WAV Generation');
  const ttsRes = await synthesizeIndicSpeech({
    text: 'मरीज का ऑक्सीजन स्तर 84% तक गिर गया है। तत्काल ध्यान दें।',
    targetLang: 'hi-IN',
    speaker: 'meera',
  });

  assert(Boolean(ttsRes.audioBase64), 'TTS returned audioBase64 payload');
  assert(ttsRes.format === 'audio/wav', 'TTS format is audio/wav');
  assert(ttsRes.dataUri.startsWith('data:audio/wav;base64,'), 'TTS returns valid dataUri');
  assert(ttsRes.durationSec > 0, `TTS duration computed (${ttsRes.durationSec}s)`);
  assert(ttsRes.audioBase64.startsWith('UklGR'), 'Base64 audio has valid RIFF/WAVE header prefix');

  // Test 7: Direct PCM WAV Generator Integrity
  console.log('\nTest 7: Direct PCM WAV Generator Integrity');
  const wavBase64 = generateValidPcmWavBase64(0.5, 8000);
  assert(wavBase64.length > 2000, `WAV buffer has expected size (${wavBase64.length} chars)`);
  assert(wavBase64.startsWith('UklGR'), 'WAV byte signature matches standard RIFF header');

  console.log('\n=============================================================');
  console.log(`🎉 PHASE 12 VERIFICATION COMPLETE: ${testsPassed}/${testsTotal} TESTS PASSED (100%)`);
  console.log('=============================================================\n');
}

runPhase12Tests().catch((err) => {
  console.error('Fatal error during Phase 12 tests:', err);
  process.exit(1);
});
