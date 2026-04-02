"""
Pydantic models for the application generator service.
Defines request/response schemas and the LangGraph state.
"""

from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field, field_validator


# ── Request models ────────────────────────────────────────────────────────────

class PriorArtItem(BaseModel):
    """A prior art reference for the Cross-References section."""
    patent_number: str
    title: str
    abstract: str | None = None


class ClaimItem(BaseModel):
    """A single patent claim from the claim drafter."""
    claim_number: int
    claim_type: Literal["INDEPENDENT", "DEPENDENT"]
    scope_level: Literal["BROAD", "MEDIUM", "NARROW"] | None = None
    parent_claim_number: int | None = None
    text: str


class GenerateSettings(BaseModel):
    """User settings forwarded from the backend."""
    api_key: str = ""
    default_model: str
    max_tokens: int = 16000


class GenerateRequest(BaseModel):
    """Input to the application generation pipeline."""
    invention_title: str = Field(max_length=500)
    invention_narrative: str = Field(max_length=200_000)
    feasibility_stage_1: str = Field(default="", max_length=200_000)
    feasibility_stage_5: str = Field(default="", max_length=200_000)
    feasibility_stage_6: str = Field(default="", max_length=200_000)
    claims: list[ClaimItem] = Field(default_factory=list)
    specification_language: str = Field(default="", max_length=200_000)
    prior_art_results: list[PriorArtItem] = Field(default_factory=list)
    compliance_passed: bool = False
    settings: GenerateSettings

    @field_validator('claims')
    @classmethod
    def cap_claims(cls, v: list[ClaimItem]) -> list[ClaimItem]:
        if len(v) > 100:
            raise ValueError('Maximum 100 claims allowed')
        return v

    @field_validator('prior_art_results')
    @classmethod
    def cap_prior_art(cls, v: list[PriorArtItem]) -> list[PriorArtItem]:
        if len(v) > 20:
            raise ValueError('Maximum 20 prior art results allowed')
        return v


# ── Output models ─────────────────────────────────────────────────────────────

class ApplicationSection(BaseModel):
    """A single section of the patent application."""
    name: str
    title: str
    content: str = ""
    paragraph_start: int = 0  # First [NNNN] in this section


class ApplicationResult(BaseModel):
    """Complete output of the application generation pipeline."""
    title: str = ""
    abstract: str = ""
    cross_references: str = ""
    background: str = ""
    summary: str = ""
    detailed_description: str = ""
    claims_text: str = ""
    figure_descriptions: str = ""
    sections: list[ApplicationSection] = Field(default_factory=list)
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_estimated_cost_usd: float = 0.0
    status: Literal["COMPLETE", "ERROR"] = "COMPLETE"
    error_message: str | None = None


# ── LangGraph state ──────────────────────────────────────────────────────────

class GraphState(BaseModel):
    """Shared state flowing through the LangGraph application pipeline."""
    # Inputs (set once at start)
    invention_title: str = ""
    invention_narrative: str = ""
    feasibility_stage_1: str = ""
    feasibility_stage_5: str = ""
    feasibility_stage_6: str = ""
    claims: list[ClaimItem] = Field(default_factory=list)
    specification_language: str = ""
    prior_art_context: str = ""
    compliance_passed: bool = False
    api_key: str = ""
    default_model: str = ""
    max_tokens: int = 16000

    # Generated sections
    background: str = ""
    summary: str = ""
    detailed_description: str = ""
    abstract: str = ""
    figure_descriptions: str = ""
    cross_references: str = ""
    claims_text: str = ""

    # Cost tracking
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_estimated_cost_usd: float = 0.0

    # Pipeline control
    step: str = "init"
    error: str | None = None
