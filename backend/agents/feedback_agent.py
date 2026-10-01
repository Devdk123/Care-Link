"""CareLink Active Learning Feedback Loop & Clinician Override Monitor.

Monitors clinician interaction with CareLink Multi-Agent recommendations:
1. Records clinician approvals and overrides on AI agent recommendations.
2. Tracks the moving override rate (threshold: 15% / 0.15).
3. Triggers Active Learning Drift Alert when override rate > 15%.
4. Generates curated fine-tuning / retraining payloads for Federated Learning & XGBoost models.
5. Persists feedback logs locally to `.runtime/feedback/feedback_audit.json`.
"""
import os
import json
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Optional
from dataclasses import dataclass, field, asdict

logger = logging.getLogger("CareLink.Feedback")

OVERRIDE_DRIFT_THRESHOLD = 0.15  # 15% tolerance


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_feedback_log_path() -> Path:
    base = Path(".runtime/feedback")
    base.mkdir(parents=True, exist_ok=True)
    return base / "feedback_audit.json"


@dataclass
class ClinicianFeedback:
    id: str
    interaction_id: str
    patient_id: str
    agent_type: str
    suggested_action: str
    clinician_action: str
    is_override: bool
    override_reason: str
    clinician_id: str
    timestamp: str = field(default_factory=_utc_now_iso)


class ActiveLearningFeedbackAgent:
    """Monitors clinician feedback and triggers active learning retraining on drift."""

    def __init__(self, log_path: Optional[Path] = None, drift_threshold: float = OVERRIDE_DRIFT_THRESHOLD):
        self.log_file = log_path or _get_feedback_log_path()
        self.drift_threshold = drift_threshold
        self.records: list[ClinicianFeedback] = self._load_records()

    def _load_records(self) -> list[ClinicianFeedback]:
        if self.log_file.exists():
            try:
                with open(self.log_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return [ClinicianFeedback(**item) for item in data]
            except Exception as e:
                logger.warning(f"Error loading feedback logs: {e}")
        return []

    def _save_records(self) -> None:
        try:
            self.log_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.log_file, "w", encoding="utf-8") as f:
                json.dump([asdict(r) for r in self.records], f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Error persisting feedback logs: {e}")

    def record_feedback(
        self,
        interaction_id: str,
        patient_id: str,
        agent_type: str,
        suggested_action: str,
        clinician_action: str,
        override_reason: str = "",
        clinician_id: str = "clinician_01",
    ) -> ClinicianFeedback:
        """Log a clinician decision, detect if override occurred, and check drift."""
        s_clean = suggested_action.strip().lower()
        c_clean = clinician_action.strip().lower()
        is_override = (s_clean != c_clean) and ("approve" not in c_clean) and ("accept" not in c_clean)

        fb_id = f"fb_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{len(self.records) + 1}"
        record = ClinicianFeedback(
            id=fb_id,
            interaction_id=interaction_id or f"int_{len(self.records)+1}",
            patient_id=patient_id,
            agent_type=agent_type,
            suggested_action=suggested_action,
            clinician_action=clinician_action,
            is_override=is_override,
            override_reason=override_reason,
            clinician_id=clinician_id,
        )

        self.records.append(record)
        self._save_records()

        # Check drift
        metrics = self.get_metrics()
        if metrics["is_drift_detected"]:
            logger.warning(
                f"ACTIVE LEARNING ALERT: Clinician override rate ({metrics['override_rate']*100:.1f}%) "
                f"exceeds safety threshold ({self.drift_threshold*100:.0f}%). Active learning retraining triggered!"
            )

        return record

    def get_metrics(self, window_size: int = 50) -> dict[str, Any]:
        """Compute moving override metrics over the latest window."""
        recent = self.records[-window_size:] if self.records else []
        total = len(recent)

        if total == 0:
            return {
                "total_reviews": 0,
                "total_overrides": 0,
                "total_approvals": 0,
                "override_rate": 0.0,
                "is_drift_detected": False,
                "status": "STABLE",
                "drift_threshold": self.drift_threshold,
                "recent_overrides": [],
            }

        overrides = sum(1 for r in recent if r.is_override)
        approvals = total - overrides
        rate = round(overrides / total, 3)
        drift = rate > self.drift_threshold

        recent_overrides = [
            asdict(r) for r in reversed(recent) if r.is_override
        ][:5]

        return {
            "total_reviews": total,
            "total_overrides": overrides,
            "total_approvals": approvals,
            "override_rate": rate,
            "is_drift_detected": drift,
            "status": "DRIFT_DETECTED" if drift else "STABLE",
            "drift_threshold": self.drift_threshold,
            "recent_overrides": recent_overrides,
        }

    def generate_retraining_payload(self) -> dict[str, Any]:
        """Compile flagged overrides into an active learning dataset for ML model fine-tuning."""
        overrides = [r for r in self.records if r.is_override]
        samples = []
        for o in overrides:
            samples.append({
                "patient_id": o.patient_id,
                "agent_type": o.agent_type,
                "ai_suggested": o.suggested_action,
                "clinician_corrected": o.clinician_action,
                "rationale": o.override_reason,
                "timestamp": o.timestamp,
            })

        return {
            "generated_at": _utc_now_iso(),
            "total_samples": len(samples),
            "target_models": ["xgboost_readmission", "triage_router"],
            "training_samples": samples,
        }


# Singleton
_feedback_agent_instance: Optional[ActiveLearningFeedbackAgent] = None


def get_feedback_agent() -> ActiveLearningFeedbackAgent:
    global _feedback_agent_instance
    if _feedback_agent_instance is None:
        _feedback_agent_instance = ActiveLearningFeedbackAgent()
    return _feedback_agent_instance


def record_clinician_feedback(
    patient_id: str,
    agent_type: str,
    suggested_action: str,
    clinician_action: str,
    override_reason: str = "",
    clinician_id: str = "Dr. Nishant Maurya",
    interaction_id: Optional[str] = None
) -> ClinicianFeedback:
    """Top-level helper to record clinician review decision."""
    import uuid
    inter_id = interaction_id or str(uuid.uuid4())
    return get_feedback_agent().record_feedback(
        interaction_id=inter_id,
        patient_id=patient_id,
        agent_type=agent_type,
        suggested_action=suggested_action,
        clinician_action=clinician_action,
        override_reason=override_reason,
        clinician_id=clinician_id
    )


def get_feedback_metrics(window_size: int = 50) -> dict[str, Any]:
    """Top-level helper to retrieve override rate and drift metrics."""
    return get_feedback_agent().get_metrics(window_size)


def generate_retraining_payload() -> dict[str, Any]:
    """Top-level helper to generate fine-tuning retraining payload."""
    return get_feedback_agent().generate_retraining_payload()
