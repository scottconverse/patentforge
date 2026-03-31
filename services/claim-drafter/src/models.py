"""
Pydantic models for the claim drafting service.
Defines request/response schemas and the LangGraph state.
"""

from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field


# ── Request models ────────────────────────────────────────────────────────────

class PriorArtItem(BaseModel):
    """A single prior art result with optional claims text."""
    patent_number: str
    title: str
    abstract: str | None = None
    relevance_score: float = 0.0
    claims_text: str | None = None


class DraftSettings(BaseModel):
    """User settings forwarded from the backend."""
    api_key: str = ""  # Prefer ANTHROPIC_API_KEY env var; request body is fallback
    default_model: str = "claude-sonnet-4-20250514"
    research_model: str = ""
    max_tokens: int = 16000


class ClaimDraftRequest(BaseModel):
    """Input to the claim drafting pipeline."""
    invention_narrative: str
    feasibility_stage_5: str = ""
    feasibility_stage_6: str = ""
    prior_art_results: list[PriorArtItem] = Field(default_factory=list)
    settings: DraftSettings


# ── Output models ─────────────────────────────────────────────────────────────

class Claim(BaseModel):
    """A single patent claim (independent or dependent)."""
    claim_number: int
    claim_type: Literal["INDEPENDENT", "DEPENDENT"]
    scope_level: Literal["BROAD", "MEDIUM", "NARROW"] | None = None
    statutory_type: str | None = None  # "method", "system", "apparatus", "crm"
    parent_claim_number: int | None = None
    text: str
    examiner_notes: str = ""


class ClaimDraftResult(BaseModel):
    """Complete output of the claim drafting pipeline."""
    claims: list[Claim] = Field(default_factory=list)
    claim_count: int = 0
    specification_language: str = ""
    planner_strategy: str = ""
    examiner_feedback: str = ""
    revision_notes: str = ""
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_estimated_cost_usd: float = 0.0
    status: Literal["COMPLETE", "ERROR"] = "COMPLETE"
    error_message: str | None = None


# ── LangGraph state ──────────────────────────────────────────────────────────

class GraphState(BaseModel):
    """
    The shared state that flows through the LangGraph pipeline.
    Each agent reads from and writes to this state.
    """
    # Inputs (set once at start)
    invention_narrative: str = ""
    feasibility_stage_5: str = ""
    feasibility_stage_6: str = ""
    prior_art_context: str = ""
    api_key: str = ""
    default_model: str = "claude-sonnet-4-20250514"
    research_model: str = ""
    max_tokens: int = 16000

    # Planner output
    planner_strategy: str = ""

    # Writer output
    draft_claims_raw: str = ""

    # Examiner output
    examiner_feedback: str = ""
    needs_revision: bool = False

    # Revision output
    revised_claims_raw: str = ""
    revision_notes: str = ""

    # Final parsed output
    claims: list[Claim] = Field(default_factory=list)
    specification_language: str = ""

    # Cost tracking (accumulated across all agent calls)
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_estimated_cost_usd: float = 0.0

    # Pipeline control
    step: str = "init"
    error: str | None = None
