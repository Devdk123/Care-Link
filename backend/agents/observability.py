"""
CareLink Observability & Telemetry Engine (Python)
LangSmith-compatible run trace instrumentation, latency tracking,
token accounting, and structured span logging.
"""

import json
import os
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
TRACE_DIR = REPO_ROOT / ".runtime" / "traces"


@dataclass
class TraceSpan:
    span_id: str
    name: str
    agent: str
    start_time: float
    end_time: Optional[float] = None
    duration_ms: Optional[float] = None
    inputs: Optional[Dict[str, Any]] = None
    outputs: Optional[Dict[str, Any]] = None
    status: str = "SUCCESS"
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class RunTrace:
    trace_id: str
    root_query: str
    routed_agent: str
    routing_confidence: float
    total_duration_ms: float
    token_usage: Dict[str, int]
    provider_used: str
    grounding_score: float
    citations: List[str]
    is_safety_blocked: bool
    spans: List[Dict[str, Any]]
    created_at: str
    status: str = "COMPLETED"
    session_id: Optional[str] = None
    patient_id: Optional[str] = None


_IN_MEMORY_TRACES: List[Dict[str, Any]] = []


def ensure_trace_dir() -> Path:
    TRACE_DIR.mkdir(parents=True, exist_ok=True)
    return TRACE_DIR


def record_run_trace(trace: RunTrace) -> None:
    try:
        ensure_trace_dir()
        trace_dict = asdict(trace)
        _IN_MEMORY_TRACES.insert(0, trace_dict)
        if len(_IN_MEMORY_TRACES) > 100:
            _IN_MEMORY_TRACES.pop()

        file_path = TRACE_DIR / f"{trace.trace_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(trace_dict, f, indent=2)
    except Exception as exc:
        print(f"[Observability] Warning: Failed to persist trace: {exc}")


def get_recent_traces(limit: int = 20) -> List[Dict[str, Any]]:
    if _IN_MEMORY_TRACES:
        return _IN_MEMORY_TRACES[:limit]

    try:
        ensure_trace_dir()
        files = sorted(TRACE_DIR.glob("*.json"), reverse=True)[:limit]
        traces = []
        for fp in files:
            with open(fp, "r", encoding="utf-8") as f:
                traces.append(json.load(f))
        return traces
    except Exception:
        return []


def get_observability_summary() -> Dict[str, Any]:
    traces = get_recentTraces_safe(100)
    if not traces:
        return {
            "total_runs": 0,
            "avg_latency_ms": 0,
            "avg_grounding_score": 1.0,
            "provider_distribution": {},
            "agent_distribution": {},
            "safety_block_count": 0,
        }

    total_lat = sum(t.get("total_duration_ms", 0) for t in traces)
    total_grd = sum(t.get("grounding_score", 0) for t in traces)
    safety_blocks = sum(1 for t in traces if t.get("is_safety_blocked"))

    providers: Dict[str, int] = {}
    agents: Dict[str, int] = {}

    for t in traces:
        p = t.get("provider_used", "fallback")
        providers[p] = providers.get(p, 0) + 1
        a = t.get("routed_agent", "triage")
        agents[a] = agents.get(a, 0) + 1

    return {
        "total_runs": len(traces),
        "avg_latency_ms": round(total_lat / len(traces)),
        "avg_grounding_score": round(total_grd / len(traces), 3),
        "provider_distribution": providers,
        "agent_distribution": agents,
        "safety_block_count": safety_blocks,
    }


def get_recentTraces_safe(limit: int = 20) -> List[Dict[str, Any]]:
    return get_recent_traces(limit)
