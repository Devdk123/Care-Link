"""CareLink Long-Term Memory Service (Mem0 & Local Resilient Fallback).

Provides patient-scoped cross-session clinical memory:
1. Integrates with Mem0 Cloud API (using `MEM0_API_KEY` from `.env`).
2. Persists to local filesystem (`.runtime/mem0/memories.json`) for zero-crash offline operation.
3. Partitions memory by `patient_id` / `user_id`.
4. Recalls chronic conditions, previous admissions, drug allergies, and clinician directives.
5. Formats memory context for prompt injection in CareLinkAgentState.
"""
import os
import json
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Optional

try:
    import httpx
except ImportError:
    httpx = None

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger("CareLink.Memory")


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_runtime_mem_path() -> Path:
    base = Path(os.getenv("MEM0_DIR", ".runtime/mem0"))
    base.mkdir(parents=True, exist_ok=True)
    return base / "memories.json"


class ClinicalMemoryService:
    """Enterprise patient cross-session memory service with Mem0 and local JSON mirror."""

    MEM0_API_BASE = "https://api.mem0.ai/v1"

    def __init__(self, api_key: Optional[str] = None, storage_path: Optional[Path] = None):
        self.api_key = api_key or os.getenv("MEM0_API_KEY", "")
        self.storage_file = storage_path or _get_runtime_mem_path()
        self._local_cache: dict[str, list[dict[str, Any]]] = self._load_local_cache()
        self.cloud_available = bool(self.api_key and httpx)

        logger.info(f"Initialized ClinicalMemoryService (Cloud: {self.cloud_available}, Local Store: {self.storage_file})")

    def _load_local_cache(self) -> dict[str, list[dict[str, Any]]]:
        if self.storage_file.exists():
            try:
                with open(self.storage_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Error reading local memory cache: {e}")
        return {}

    def _save_local_cache(self) -> None:
        try:
            self.storage_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.storage_file, "w", encoding="utf-8") as f:
                json.dump(self._local_cache, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Error persisting local memory cache: {e}")

    def remember(
        self,
        patient_id: str,
        memory_text: str,
        category: str = "clinical_history",
        session_id: str = "",
        metadata: Optional[dict[str, Any]] = None,
    ) -> bool:
        """Store an episodic or chronic patient memory."""
        if not patient_id or not memory_text:
            return False

        clean_pid = patient_id.strip()
        record = {
            "id": f"mem_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{abs(hash(memory_text)) % 10000}",
            "patient_id": clean_pid,
            "text": memory_text.strip(),
            "category": category,
            "session_id": session_id,
            "metadata": metadata or {},
            "created_at": _utc_now_iso(),
        }

        # 1. Update local cache
        if clean_pid not in self._local_cache:
            self._local_cache[clean_pid] = []

        # Avoid exact duplicates
        if not any(m.get("text") == record["text"] for m in self._local_cache[clean_pid]):
            self._local_cache[clean_pid].append(record)
            self._save_local_cache()

        # 2. Async/Best-effort sync with Mem0 Cloud
        if self.cloud_available and httpx:
            try:
                headers = {
                    "Authorization": f"Token {self.api_key}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "messages": [
                        {"role": "user", "content": f"Patient Clinical Note: {memory_text}"},
                        {"role": "assistant", "content": f"Acknowledged chronic memory for patient {clean_pid}."},
                    ],
                    "user_id": clean_pid,
                    "metadata": {
                        "category": category,
                        "session_id": session_id,
                        "source": "carelink_agentic",
                    },
                }
                with httpx.Client(timeout=4.0, verify=False) as client:
                    resp = client.post(f"{self.MEM0_API_BASE}/memories/", json=payload, headers=headers)
                    if resp.status_code in (200, 201):
                        logger.debug(f"Saved memory to Mem0 Cloud for patient {clean_pid}.")
            except Exception as e:
                logger.debug(f"Mem0 Cloud sync skipped ({e}); cached locally.")

        return True

    def recall(
        self,
        patient_id: str,
        query: str = "",
        limit: int = 5,
    ) -> list[str]:
        """Recall top matching memories for a patient."""
        if not patient_id:
            return []

        clean_pid = patient_id.strip()
        memories: list[str] = []

        # 1. Try Mem0 Cloud search first if available
        if self.cloud_available and httpx and query:
            try:
                headers = {
                    "Authorization": f"Token {self.api_key}",
                    "Content-Type": "application/json",
                }
                search_payload = {
                    "query": query,
                    "user_id": clean_pid,
                    "limit": limit,
                }
                with httpx.Client(timeout=3.0, verify=False) as client:
                    resp = client.post(f"{self.MEM0_API_BASE}/memories/search/", json=search_payload, headers=headers)
                    if resp.status_code == 200:
                        results = resp.json()
                        records = results.get("results", results) if isinstance(results, dict) else results
                        for item in records or []:
                            txt = item.get("memory") or item.get("text")
                            if txt and txt not in memories:
                                memories.append(txt)
                        if memories:
                            return memories[:limit]
            except Exception as e:
                logger.debug(f"Mem0 Cloud recall fallback to local cache: {e}")

        # 2. Local Cache Semantic / Keyword Match
        patient_records = self._local_cache.get(clean_pid, [])
        if not patient_records:
            return []

        if not query:
            return [r["text"] for r in patient_records[-limit:]]

        q_words = set(query.lower().split())
        scored: list[tuple[int, str]] = []
        for r in patient_records:
            text = r["text"]
            t_words = set(text.lower().split())
            overlap = len(q_words.intersection(t_words))
            scored.append((overlap, text))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [text for _, text in scored[:limit]]

    def get_patient_memories(self, patient_id: str) -> list[dict[str, Any]]:
        """Return all structured memory records for a given patient."""
        return self._local_cache.get(patient_id.strip(), [])

    def format_memory_context(self, memories: list[str]) -> str:
        """Format recalled memories into a clinical context prompt injection."""
        if not memories:
            return ""

        lines = [
            "-- PATIENT LONG-TERM CLINICAL MEMORY (MEM0) --",
            "The following chronic history, past admissions, and allergies were recalled across sessions:",
        ]
        for m in memories:
            lines.append(f"- {m}")
        lines.append("----------------------------------------------")
        return "\n".join(lines)


# Singleton
_memory_instance: Optional[ClinicalMemoryService] = None


def get_memory_service() -> ClinicalMemoryService:
    global _memory_instance
    if _memory_instance is None:
        _memory_instance = ClinicalMemoryService()
    return _memory_instance


def remember_patient(
    patient_id: str,
    text: str,
    category: str = "clinical_history",
    session_id: Optional[str] = None
) -> bool:
    """Top-level helper to add patient clinical memory."""
    return get_memory_service().remember(
        patient_id=patient_id,
        memory_text=text,
        category=category,
        session_id=session_id or ""
    )


def recall_patient(
    patient_id: str,
    query: str = "",
    limit: int = 3
) -> list[str]:
    """Top-level helper to search and recall patient clinical memory."""
    return get_memory_service().recall(
        patient_id=patient_id,
        query=query,
        limit=limit
    )
