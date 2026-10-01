/**
 * CareLink Long-Term Memory Service (TypeScript / Client & Node)
 * Integrates with Mem0 Cloud API with resilient in-memory / local fallback.
 */

export interface PatientMemoryRecord {
  id: string;
  patientId: string;
  text: string;
  category: string;
  sessionId: string;
  createdAt: string;
}

// In-memory partition for browser/node runtime
const LOCAL_MEMORY_STORE = new Map<string, PatientMemoryRecord[]>();

export async function rememberPatient(
  patientId: string,
  memoryText: string,
  category = "clinical_history",
  sessionId = ""
): Promise<boolean> {
  if (!patientId || !memoryText) return false;

  const cleanPid = patientId.trim();
  const record: PatientMemoryRecord = {
    id: `mem_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    patientId: cleanPid,
    text: memoryText.trim(),
    category,
    sessionId,
    createdAt: new Date().toISOString()
  };

  // 1. Save to local store
  if (!LOCAL_MEMORY_STORE.has(cleanPid)) {
    LOCAL_MEMORY_STORE.set(cleanPid, []);
  }
  const existing = LOCAL_MEMORY_STORE.get(cleanPid)!;
  if (!existing.some((r) => r.text === record.text)) {
    existing.push(record);
  }

  // 2. Best-effort sync with Mem0 Cloud if key available
  const apiKey = process.env.MEM0_API_KEY || process.env.VITE_MEM0_API_KEY;
  if (apiKey && typeof fetch !== "undefined") {
    try {
      await fetch("https://api.mem0.ai/v1/memories/", {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [
            { role: "user", content: `Patient Clinical Note: ${memoryText}` },
            { role: "assistant", content: `Acknowledged chronic memory for patient ${cleanPid}.` }
          ],
          user_id: cleanPid,
          metadata: { category, sessionId, source: "carelink_agentic" }
        })
      });
    } catch {
      // Fail open: local store preserves memory
    }
  }

  return true;
}

export async function recallPatient(
  patientId: string,
  query = "",
  limit = 5
): Promise<string[]> {
  if (!patientId) return [];
  const cleanPid = patientId.trim();
  const memories: string[] = [];

  // 1. Try Mem0 Cloud search
  const apiKey = process.env.MEM0_API_KEY || process.env.VITE_MEM0_API_KEY;
  if (apiKey && query && typeof fetch !== "undefined") {
    try {
      const res = await fetch("https://api.mem0.ai/v1/memories/search/", {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          user_id: cleanPid,
          limit
        })
      });

      if (res.ok) {
        const data = await res.json();
        const records = Array.isArray(data) ? data : data.results || [];
        for (const item of records) {
          const txt = item.memory || item.text;
          if (txt && !memories.includes(txt)) {
            memories.push(txt);
          }
        }
        if (memories.length > 0) {
          return memories.slice(0, limit);
        }
      }
    } catch {
      // Fallback silently to local cache
    }
  }

  // 2. Local Cache Keyword Match
  const localList = LOCAL_MEMORY_STORE.get(cleanPid) || [];
  if (localList.length === 0) return [];

  if (!query) {
    return localList.slice(-limit).map((r) => r.text);
  }

  const qWords = query.toLowerCase().split(/\s+/);
  const scored = localList.map((r) => {
    const textLower = r.text.toLowerCase();
    const hits = qWords.filter((w) => textLower.includes(w)).length;
    return { text: r.text, score: hits };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.text);
}

export function formatMemoryContext(memories: string[]): string {
  if (!memories || memories.length === 0) return "";
  const lines = [
    "-- PATIENT LONG-TERM CLINICAL MEMORY (MEM0) --",
    "The following chronic history, past admissions, and allergies were recalled across sessions:"
  ];
  memories.forEach((m) => lines.push(`- ${m}`));
  lines.push("----------------------------------------------");
  return lines.join("\n");
}
