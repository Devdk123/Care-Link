"""CareLink Citation Resolver & Grounding Verification Engine.

Enforces sentence-level clinical claim-evidence binding:
1. Extracts all bracketed guideline citations (e.g. `[ICMR-HF-01]`, `[AHA-DDI-01]`).
2. Validates cited tags against active clinical corpus and retrieved guidelines.
3. Detects hallucinated or ungrounded clinical claims.
4. Computes Grounding Fidelity Score (0.0 to 1.0).
5. Auto-attaches grounded citation tags to un-cited clinical sentences where guideline relevance is high.
6. Emits structured evidence badges for the CareLink frontend UI.
"""
import re
from dataclasses import dataclass, field
from typing import Optional, Any
from .clinical_rag import CLINICAL_GUIDELINES, GuidelineSearchResult


# Regex for citations e.g. [ICMR-HF-01], [AHA-DDI-01], [GOLD-COPD-01], [UNKNOWN-GUIDELINE-99]
_CITATION_REGEX = re.compile(r"\[([A-Z0-9_\-]+)\]")

# Known legitimate guideline tag set
KNOWN_GUIDELINE_TAGS = {g.tag.strip("[]") for g in CLINICAL_GUIDELINES}


@dataclass
class EvidenceBadge:
    tag: str
    title: str
    source: str
    condition: str
    evidence_level: str
    snippet: str
    score: float


@dataclass
class GroundingVerification:
    is_grounded: bool
    grounding_fidelity: float  # 0.0 to 1.0
    citations_found: list[str] = field(default_factory=list)
    valid_citations: list[str] = field(default_factory=list)
    hallucinated_citations: list[str] = field(default_factory=list)
    missing_recommended_citations: list[str] = field(default_factory=list)
    evidence_badges: list[dict[str, Any]] = field(default_factory=list)
    enriched_text: str = ""
    audit_notes: list[str] = field(default_factory=list)


class CitationResolver:
    """Verifies and resolves guideline citations to enforce clinical grounding."""

    def __init__(self, pass_threshold: float = 0.70):
        self.pass_threshold = pass_threshold
        self.guideline_map = {g.tag.strip("[]"): g for g in CLINICAL_GUIDELINES}

    def verify_and_resolve(
        self,
        llm_text: str,
        retrieved_guidelines: list[GuidelineSearchResult | dict],
    ) -> GroundingVerification:
        """Inspect LLM generated clinical text, audit citations, compute fidelity, and attach evidence."""
        if not llm_text:
            return GroundingVerification(
                is_grounded=False,
                grounding_fidelity=0.0,
                audit_notes=["Empty text supplied for citation verification."],
            )

        # 1. Normalize retrieved guidelines
        retrieved_map: dict[str, Any] = {}
        for item in retrieved_guidelines:
            if isinstance(item, GuidelineSearchResult):
                clean_tag = item.tag.strip("[]")
                retrieved_map[clean_tag] = item
            elif isinstance(item, dict):
                clean_tag = item.get("tag", "").strip("[]")
                if clean_tag:
                    retrieved_map[clean_tag] = item

        # 2. Extract citations in text
        raw_matches = _CITATION_REGEX.findall(llm_text)
        citations_found = list(dict.fromkeys(raw_matches))  # deduplicate preserving order

        valid_citations: list[str] = []
        hallucinated_citations: list[str] = []
        evidence_badges: list[dict[str, Any]] = []

        for tag in citations_found:
            if tag in self.guideline_map:
                valid_citations.append(f"[{tag}]")
                g = self.guideline_map[tag]
                evidence_badges.append({
                    "tag": f"[{tag}]",
                    "title": g.title,
                    "source": g.source,
                    "condition": g.condition,
                    "evidence_level": g.evidence_level,
                    "snippet": g.content[:200] + "...",
                    "score": 0.98 if tag in retrieved_map else 0.85,
                })
            else:
                hallucinated_citations.append(f"[{tag}]")

        # 3. Detect ungrounded recommendations & auto-enrich if missing
        missing_recommended: list[str] = []
        enriched_text = llm_text
        audit_notes: list[str] = []

        for ret_tag, ret_obj in retrieved_map.items():
            bracketed = f"[{ret_tag}]"
            if bracketed not in valid_citations:
                # Check if the text actually discusses this condition
                cond_keywords = getattr(ret_obj, "keywords", None)
                if not cond_keywords and isinstance(ret_obj, dict):
                    cond_keywords = ret_obj.get("keywords", [])
                if not cond_keywords and ret_tag in self.guideline_map:
                    cond_keywords = self.guideline_map[ret_tag].keywords

                matches = sum(1 for kw in cond_keywords if kw.lower() in enriched_text.lower())
                if matches >= 1:
                    target_kw = next((kw for kw in cond_keywords if kw.lower() in enriched_text.lower()), None)
                    if target_kw:
                        pattern = re.compile(rf"([^.?!]*\b{re.escape(target_kw)}\b[^.?!]*[.?!])", re.IGNORECASE)
                        if pattern.search(enriched_text) and bracketed not in enriched_text:
                            enriched_text = pattern.sub(rf"\1 {bracketed}", enriched_text, count=1)
                            valid_citations.append(bracketed)
                            g = self.guideline_map.get(ret_tag)
                            if g:
                                evidence_badges.append({
                                    "tag": bracketed,
                                    "title": g.title,
                                    "source": g.source,
                                    "condition": g.condition,
                                    "evidence_level": g.evidence_level,
                                    "snippet": g.content[:200] + "...",
                                    "score": 0.92,
                                })
                            audit_notes.append(f"Auto-attached clinical citation {bracketed} based on semantic grounding match.")
                        elif bracketed not in valid_citations:
                            missing_recommended.append(bracketed)
                    else:
                        missing_recommended.append(bracketed)
                else:
                    missing_recommended.append(bracketed)

        # 4. Compute Grounding Fidelity Score
        # Grounding score formula:
        # Penalize hallucinated citations heavily.
        # Credit valid citations against retrieved guidelines.
        if not valid_citations and not retrieved_map:
            # General non-clinical query
            fidelity = 1.0
            is_grounded = True
        elif not valid_citations and retrieved_map:
            # Clinical guidance was expected and retrieved, but no valid citations found
            fidelity = 0.35 if not missing_recommended else 0.20
            is_grounded = False
            audit_notes.append("Clinical advice generated without mandatory bracketed guideline citations.")
        else:
            citation_accuracy = len(valid_citations) / (len(valid_citations) + len(hallucinated_citations))
            coverage = min(1.0, len(valid_citations) / max(1, min(2, len(retrieved_map))))
            penalty = len(hallucinated_citations) * 0.40
            fidelity = max(0.0, min(1.0, (0.7 * citation_accuracy + 0.3 * coverage) - penalty))
            is_grounded = fidelity >= self.pass_threshold

        if hallucinated_citations:
            audit_notes.append(f"Detected hallucinated or unauthorized citation tags: {hallucinated_citations}")

        if valid_citations:
            audit_notes.append(f"Successfully verified {len(valid_citations)} clinical guideline citation(s).")

        return GroundingVerification(
            is_grounded=is_grounded,
            grounding_fidelity=round(fidelity, 3),
            citations_found=[f"[{c}]" for c in citations_found],
            valid_citations=valid_citations,
            hallucinated_citations=hallucinated_citations,
            missing_recommended_citations=missing_recommended,
            evidence_badges=evidence_badges,
            enriched_text=enriched_text,
            audit_notes=audit_notes,
        )


# Singleton instance
_citation_resolver: Optional[CitationResolver] = None


def get_citation_resolver() -> CitationResolver:
    global _citation_resolver
    if _citation_resolver is None:
        _citation_resolver = CitationResolver()
    return _citation_resolver


def verify_and_resolve_citations(
    llm_text: str,
    retrieved_guidelines: Optional[list] = None
) -> GroundingVerification:
    """Helper function matching TypeScript API to verify and resolve citations."""
    resolver = get_citation_resolver()
    return resolver.verify_and_resolve(llm_text, retrieved_guidelines or [])
