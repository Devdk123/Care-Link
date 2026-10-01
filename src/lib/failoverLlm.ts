/**
 * CareLink Resilient Model Gateway & Failover Engine
 * 
 * Auto-Failover Strategy:
 * 1. Primary: Google Gemini (gemini-2.5-flash, backup: gemini-1.5-flash)
 * 2. Failover: When Gemini encounters rate-limits (HTTP 429), quota limits, or spikes (HTTP 503),
 *    it instantly auto-switches to Groq (llama-3.3-70b-versatile / llama-3.1-8b-instant).
 * 3. Fallback: Safe clinical fallback structure if both providers are unreachable.
 */

export interface ModelMetrics {
  provider: 'gemini' | 'groq' | 'fallback';
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  failoverOccurred: boolean;
  failoverReason?: string;
}

export interface LlmCallOptions {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
  fallbackText: string;
  jsonMode?: boolean;
}

export interface LlmCallResult<T = string> {
  data: T;
  rawText: string;
  metrics: ModelMetrics;
}

// Pricing estimates per 1M tokens (USD)
const PRICING_MAP: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'openai/gpt-oss-120b': { input: 0.60, output: 0.90 },
};

function calculateCost(model: string, inTokens: number, outTokens: number): number {
  const rate = PRICING_MAP[model] || { input: 0.20, output: 0.60 };
  const cost = (inTokens / 1_000_000) * rate.input + (outTokens / 1_000_000) * rate.output;
  return Number(cost.toFixed(6));
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Safely parse JSON from LLM output, extracting from markdown codeblocks if present
 */
export function extractJsonFromText<T = any>(text: string, fallback: T): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Try markdown fenced blocks ```json ... ```
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1].trim()) as T;
      } catch {
        // Fallthrough
      }
    }

    // Try finding outermost braces { ... }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        // Fallthrough
      }
    }
    return fallback;
  }
}

/**
 * Call Google Gemini REST API directly
 */
async function callGemini(
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  jsonMode: boolean,
  apiKey: string
): Promise<{ text: string; inTokens: number; outTokens: number }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload: any = {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userMessage }]
      }
    ],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.2,
      responseMimeType: jsonMode ? "application/json" : "text/plain"
    }
  };

  const inTokens = estimateTokens(systemPrompt + " " + userMessage);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Gemini HTTP ${response.status}: ${errorBody.slice(0, 160)}`);
  }

  const data = (await response.json()) as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  const outTokens = estimateTokens(text);

  return { text, inTokens, outTokens };
}

/**
 * Call Groq Cloud API directly (OpenAI-compatible chat completions)
 */
async function callGroq(
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  jsonMode: boolean,
  apiKey: string
): Promise<{ text: string; inTokens: number; outTokens: number }> {
  const url = "https://api.groq.com/openai/v1/chat/completions";

  // For reasoning models like openai/gpt-oss-*, internal reasoning consumes tokens first.
  const effectiveMaxTokens = model.includes('oss') ? Math.max(maxTokens, 350) : maxTokens;

  const payload: any = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ],
    max_tokens: effectiveMaxTokens,
    temperature: 0.2
  };

  if (jsonMode) {
    payload.response_format = { type: "json_object" };
  }

  const inTokens = estimateTokens(systemPrompt + " " + userMessage);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Groq HTTP ${response.status}: ${errorBody.slice(0, 160)}`);
  }

  const data = (await response.json()) as any;
  const text = data.choices?.[0]?.message?.content?.trim() || "";
  const outTokens = estimateTokens(text);

  return { text, inTokens, outTokens };
}

/**
 * Main Failover Dispatcher
 * Calls Gemini (Primary) -> Groq (Auto-Failover) -> Static Fallback
 */
export async function callWithFailover(options: LlmCallOptions): Promise<LlmCallResult<string>> {
  const {
    systemPrompt,
    userMessage,
    maxTokens = 600,
    fallbackText,
    jsonMode = false
  } = options;

  const startTime = Date.now();
  let failoverOccurred = false;
  let failoverReason: string | undefined;

  // ── Browser Client Security Shield ──
  // When running inside a browser, delegate directly to the secure server endpoint.
  // This guarantees zero API keys (GEMINI_API_KEY, GROQ_API_KEY) are ever exposed in client bundles or window.
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/agent/llm-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      if (res.ok) {
        return (await res.json()) as LlmCallResult<string>;
      }
    } catch (browserErr) {
      console.warn('[FailoverGateway] Client-side proxy call failed, falling back to safe local response:', browserErr);
    }

    const latencyMs = Date.now() - startTime;
    return {
      data: fallbackText,
      rawText: fallbackText,
      metrics: {
        provider: 'fallback',
        model: 'deterministic-clinical-v1',
        latencyMs,
        inputTokens: estimateTokens(systemPrompt + " " + userMessage),
        outputTokens: estimateTokens(fallbackText),
        costUsd: 0,
        failoverOccurred: true,
        failoverReason: 'Client-side proxy fallback'
      }
    };
  }

  // ── Server-Side Execution (Node.js) ──
  // Keys are read solely from process.env on the secure server
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const groqKey = process.env.GROQ_API_KEY || '';

  // ── Step 1: Attempt Gemini (Primary LLM) ──
  if (geminiKey) {
    const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-1.5-flash'];
    for (const model of models) {
      try {
        const { text, inTokens, outTokens } = await callGemini(
          model,
          systemPrompt,
          userMessage,
          maxTokens,
          jsonMode,
          geminiKey
        );

        if (text) {
          const latencyMs = Date.now() - startTime;
          return {
            data: text,
            rawText: text,
            metrics: {
              provider: 'gemini',
              model,
              latencyMs,
              inputTokens: inTokens,
              outputTokens: outTokens,
              costUsd: calculateCost(model, inTokens, outTokens),
              failoverOccurred: false
            }
          };
        }
      } catch (geminiErr: any) {
        console.warn(`[FailoverGateway] Gemini (${model}) failed: ${geminiErr.message?.slice(0, 100)}`);
        failoverOccurred = true;
        failoverReason = geminiErr.message || 'Gemini RateLimit/Error';
      }
    }
  } else {
    failoverOccurred = true;
    failoverReason = 'No GEMINI_API_KEY provided';
  }

  // ── Step 2: Auto-Failover to Groq (Secondary LLM) ──
  if (groqKey) {
    const groqModels = [
      process.env.GROQ_ROUTING_MODEL || 'qwen/qwen3.8-27b',
      process.env.GROQ_REASONING_MODEL || 'openai/gpt-oss-120b',
      'openai/gpt-oss-20b'
    ];

    for (const model of groqModels) {
      try {
        console.info(`[FailoverGateway] Failover active: routing request to Groq (${model})...`);
        const { text, inTokens, outTokens } = await callGroq(
          model,
          systemPrompt,
          userMessage,
          maxTokens,
          jsonMode,
          groqKey
        );

        if (text) {
          const latencyMs = Date.now() - startTime;
          return {
            data: text,
            rawText: text,
            metrics: {
              provider: 'groq',
              model,
              latencyMs,
              inputTokens: inTokens,
              outputTokens: outTokens,
              costUsd: calculateCost(model, inTokens, outTokens),
              failoverOccurred: true,
              failoverReason
            }
          };
        }
      } catch (groqErr: any) {
        console.warn(`[FailoverGateway] Groq (${model}) failed: ${groqErr.message?.slice(0, 100)}`);
      }
    }
  }

  // ── Step 3: Deterministic Safe Fallback ──
  console.warn('[FailoverGateway] All LLM providers unreachable. Engaging safe clinical fallback.');
  const latencyMs = Date.now() - startTime;
  return {
    data: fallbackText,
    rawText: fallbackText,
    metrics: {
      provider: 'fallback',
      model: 'deterministic-clinical-template',
      latencyMs,
      inputTokens: estimateTokens(systemPrompt + " " + userMessage),
      outputTokens: estimateTokens(fallbackText),
      costUsd: 0.0,
      failoverOccurred: true,
      failoverReason: failoverReason || 'All upstream AI services unavailable'
    }
  };
}

/**
 * Type-safe JSON failover caller
 */
export async function callWithFailoverJson<T>(
  options: Omit<LlmCallOptions, 'jsonMode'>,
  fallbackObj: T
): Promise<LlmCallResult<T>> {
  const result = await callWithFailover({ ...options, jsonMode: true });
  const parsed = extractJsonFromText<T>(result.rawText, fallbackObj);
  return {
    data: parsed,
    rawText: result.rawText,
    metrics: result.metrics
  };
}
