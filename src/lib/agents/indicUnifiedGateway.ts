/**
 * CareLink Unified Indic Linguistic Gateway (Bhashini + Sarvam AI)
 * 
 * Bridges Government of India's Digital India Bhashini (NLTM / MeitY)
 * with Sarvam AI's Indic Foundation Models.
 * 
 * Provides:
 * - Dynamic Provider Routing (bhashini | sarvam | auto)
 * - Zero-Latency Auto-Failover (Bhashini <-> Sarvam AI)
 * - 22 Official Scheduled Indian Languages
 * - High-Fidelity Clinical Vocabulary Preservation
 */

import dotenv from 'dotenv';
import {
  translateIndicText,
  synthesizeIndicSpeech,
  getSupportedIndicLanguages,
} from './sarvamIndicAgent';
import {
  translateBhashini,
  synthesizeBhashiniSpeech,
  getBhashiniLanguages,
  normalizeBhashiniLangCode,
} from './bhashiniAgent';

dotenv.config();

export type IndicProvider = 'auto' | 'bhashini' | 'sarvam';

export interface UnifiedTranslateRequest {
  text: string;
  sourceLang?: string;
  targetLang: string;
  provider?: IndicProvider;
}

export interface UnifiedTranslateResult {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  providerUsed: 'bhashini' | 'sarvam' | 'bhashini_fallback' | 'deterministic' | 'llm_fallback' | 'original';
  engineName: string;
  failoverOccurred: boolean;
  latencyMs: number;
}

export interface UnifiedTtsRequest {
  text: string;
  targetLang: string;
  provider?: IndicProvider;
  gender?: 'female' | 'male';
}

export interface UnifiedTtsResult {
  audioBase64: string;
  dataUri: string;
  format: 'audio/wav';
  durationSec: number;
  providerUsed: 'bhashini' | 'sarvam' | 'mock_pcm';
  engineName: string;
  latencyMs: number;
}

/**
 * Check provider credentials detection
 */
export function getIndicProvidersStatus() {
  const bhashiniKey = process.env.BHASHINI_API_KEY;
  const hasBhashini = Boolean(bhashiniKey && bhashiniKey.trim() !== '' && !bhashiniKey.includes('your-bhashini'));

  const sarvamKey = process.env.SARVAM_API_KEY;
  const hasSarvam = Boolean(sarvamKey && sarvamKey.trim() !== '' && !sarvamKey.includes('your-sarvam'));

  const defaultPref = (process.env.INDIC_DEFAULT_PROVIDER || 'auto').toLowerCase() as IndicProvider;

  return {
    bhashini: {
      name: 'Digital India Bhashini (MeitY)',
      role: 'Government of India National Language Translation Mission',
      models: 'IndicTrans2 (NMT) + Indic-TTS (Speech)',
      isConfigured: hasBhashini,
      languagesCount: getBhashiniLanguages().length,
    },
    sarvam: {
      name: 'Sarvam AI Indic Foundation',
      role: 'Private Indian Foundation AI Stack',
      models: 'mayura:v1 (Translation) + bulbul:v1 (TTS)',
      isConfigured: hasSarvam,
      languagesCount: getSupportedIndicLanguages().length,
    },
    defaultProvider: defaultPref,
    failoverAvailable: true,
  };
}

/**
 * Unified Translation with Auto-Failover
 */
export async function translateIndicUnified(req: UnifiedTranslateRequest): Promise<UnifiedTranslateResult> {
  const startTime = Date.now();
  const text = (req.text || '').trim();
  const providerPref = req.provider || (process.env.INDIC_DEFAULT_PROVIDER as IndicProvider) || 'auto';

  if (!text) {
    return {
      translatedText: '',
      sourceLang: req.sourceLang || 'en',
      targetLang: req.targetLang,
      providerUsed: 'original',
      engineName: 'None',
      failoverOccurred: false,
      latencyMs: 0,
    };
  }

  // If explicitly requested Bhashini or auto-selected
  if (providerPref === 'bhashini') {
    try {
      const bhashiniRes = await translateBhashini({
        text,
        sourceLang: req.sourceLang,
        targetLang: req.targetLang,
      });
      return {
        translatedText: bhashiniRes.translatedText,
        sourceLang: bhashiniRes.sourceLang,
        targetLang: bhashiniRes.targetLang,
        providerUsed: bhashiniRes.provider,
        engineName: 'Digital India Bhashini (IndicTrans2)',
        failoverOccurred: false,
        latencyMs: Date.now() - startTime,
      };
    } catch {
      // Failover to Sarvam
      const sarvamRes = await translateIndicText({
        text,
        sourceLang: req.sourceLang,
        targetLang: req.targetLang,
      });
      return {
        translatedText: sarvamRes.translatedText,
        sourceLang: sarvamRes.sourceLang,
        targetLang: sarvamRes.targetLang,
        providerUsed: sarvamRes.provider,
        engineName: 'Sarvam AI (Failover from Bhashini)',
        failoverOccurred: true,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  if (providerPref === 'sarvam') {
    try {
      const sarvamRes = await translateIndicText({
        text,
        sourceLang: req.sourceLang,
        targetLang: req.targetLang,
      });
      return {
        translatedText: sarvamRes.translatedText,
        sourceLang: sarvamRes.sourceLang,
        targetLang: sarvamRes.targetLang,
        providerUsed: sarvamRes.provider,
        engineName: 'Sarvam AI (mayura:v1)',
        failoverOccurred: false,
        latencyMs: Date.now() - startTime,
      };
    } catch {
      // Failover to Bhashini
      const bhashiniRes = await translateBhashini({
        text,
        sourceLang: req.sourceLang,
        targetLang: req.targetLang,
      });
      return {
        translatedText: bhashiniRes.translatedText,
        sourceLang: bhashiniRes.sourceLang,
        targetLang: bhashiniRes.targetLang,
        providerUsed: bhashiniRes.provider,
        engineName: 'Digital India Bhashini (Failover from Sarvam)',
        failoverOccurred: true,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // AUTO Routing Strategy:
  // If Bhashini key present -> primary Bhashini with Sarvam failover
  // If Sarvam key present -> primary Sarvam with Bhashini failover
  // If neither present -> Bhashini / Sarvam clinical deterministic fallback
  const status = getIndicProvidersStatus();
  if (status.bhashini.isConfigured) {
    try {
      const bRes = await translateBhashini({ text, sourceLang: req.sourceLang, targetLang: req.targetLang });
      return {
        translatedText: bRes.translatedText,
        sourceLang: bRes.sourceLang,
        targetLang: bRes.targetLang,
        providerUsed: bRes.provider,
        engineName: 'Digital India Bhashini (Auto-Routed)',
        failoverOccurred: false,
        latencyMs: Date.now() - startTime,
      };
    } catch {
      const sRes = await translateIndicText({ text, sourceLang: req.sourceLang, targetLang: req.targetLang });
      return {
        translatedText: sRes.translatedText,
        sourceLang: sRes.sourceLang,
        targetLang: sRes.targetLang,
        providerUsed: sRes.provider,
        engineName: 'Sarvam AI (Auto-Failover)',
        failoverOccurred: true,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // Default to Sarvam translation (or clinical fallback)
  const defaultRes = await translateIndicText({
    text,
    sourceLang: req.sourceLang,
    targetLang: req.targetLang,
  });

  return {
    translatedText: defaultRes.translatedText,
    sourceLang: defaultRes.sourceLang,
    targetLang: defaultRes.targetLang,
    providerUsed: defaultRes.provider,
    engineName: 'Sarvam AI / Bharat Indic Stack',
    failoverOccurred: false,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Unified Text-To-Speech with Auto-Failover
 */
export async function synthesizeIndicUnifiedSpeech(req: UnifiedTtsRequest): Promise<UnifiedTtsResult> {
  const startTime = Date.now();
  const providerPref = req.provider || (process.env.INDIC_DEFAULT_PROVIDER as IndicProvider) || 'auto';

  if (providerPref === 'bhashini') {
    try {
      const bRes = await synthesizeBhashiniSpeech({
        text: req.text,
        targetLang: req.targetLang,
        gender: req.gender,
      });
      return {
        audioBase64: bRes.audioBase64,
        dataUri: bRes.dataUri,
        format: 'audio/wav',
        durationSec: bRes.durationSec,
        providerUsed: bRes.provider === 'bhashini' ? 'bhashini' : 'mock_pcm',
        engineName: 'Digital India Bhashini Indic-TTS',
        latencyMs: Date.now() - startTime,
      };
    } catch {
      const sRes = await synthesizeIndicSpeech({
        text: req.text,
        targetLang: req.targetLang,
      });
      return {
        audioBase64: sRes.audioBase64,
        dataUri: sRes.dataUri,
        format: 'audio/wav',
        durationSec: sRes.durationSec,
        providerUsed: sRes.provider === 'sarvam' ? 'sarvam' : 'mock_pcm',
        engineName: 'Sarvam AI bulbul:v1 (Failover)',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // Standard path: Sarvam AI or Bhashini
  try {
    const sRes = await synthesizeIndicSpeech({
      text: req.text,
      targetLang: req.targetLang,
    });
    return {
      audioBase64: sRes.audioBase64,
      dataUri: sRes.dataUri,
      format: 'audio/wav',
      durationSec: sRes.durationSec,
      providerUsed: sRes.provider === 'sarvam' ? 'sarvam' : 'mock_pcm',
      engineName: 'Sarvam AI bulbul:v1',
      latencyMs: Date.now() - startTime,
    };
  } catch {
    const bRes = await synthesizeBhashiniSpeech({
      text: req.text,
      targetLang: req.targetLang,
      gender: req.gender,
    });
    return {
      audioBase64: bRes.audioBase64,
      dataUri: bRes.dataUri,
      format: 'audio/wav',
      durationSec: bRes.durationSec,
      providerUsed: bRes.provider === 'bhashini' ? 'bhashini' : 'mock_pcm',
      engineName: 'Digital India Bhashini (Failover)',
      latencyMs: Date.now() - startTime,
    };
  }
}
