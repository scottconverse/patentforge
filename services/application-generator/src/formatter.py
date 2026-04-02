"""
USPTO formatter — applies paragraph numbering and assembles the full application.
"""

from __future__ import annotations
import re

from .models import GraphState, ApplicationResult, ApplicationSection, ClaimItem


def _format_claims(claims: list[ClaimItem]) -> str:
    """Format claims in standard patent application style."""
    if not claims:
        return ""
    lines = []
    lines.append("What is claimed is:")
    lines.append("")
    for c in claims:
        text = c.text.strip()
        # Ensure claim starts with proper numbering
        if not text.startswith(f"{c.claim_number}."):
            text = f"{c.claim_number}. {text}"
        lines.append(text)
        lines.append("")
    return "\n".join(lines)


def _format_cross_references(prior_art: str) -> str:
    """Format cross-references section from prior art context."""
    if not prior_art or prior_art == "(No prior art results available)":
        return ""
    return prior_art


def _number_paragraphs(text: str, start: int) -> tuple[str, int]:
    """
    Add USPTO paragraph numbering [NNNN] to each paragraph.
    Returns the numbered text and the next paragraph number.
    """
    if not text.strip():
        return "", start

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    numbered = []
    counter = start

    for para in paragraphs:
        # Don't number lines that are just figure references (FIG. X is a...)
        # or claim lines (1. A method...)
        if re.match(r'^\d+\.', para) or re.match(r'^What is claimed', para):
            numbered.append(para)
            continue
        numbered.append(f"[{counter:04d}] {para}")
        counter += 1

    return "\n\n".join(numbered), counter


def assemble(state: GraphState) -> GraphState:
    """Assemble all sections with formatting. Called as a sync LangGraph node."""
    state.cross_references = _format_cross_references(state.prior_art_context)
    state.claims_text = _format_claims(state.claims)
    state.step = "assemble_complete"
    return state


def build_application_result(state: GraphState) -> ApplicationResult:
    """Build the final ApplicationResult with paragraph-numbered sections."""
    sections = []
    counter = 1

    # Section order per USPTO convention
    section_defs = [
        ("cross_references", "Cross-Reference to Related Applications", state.cross_references),
        ("background", "Background of the Invention", state.background),
        ("summary", "Summary of the Invention", state.summary),
        ("figure_descriptions", "Brief Description of the Drawings", state.figure_descriptions),
        ("detailed_description", "Detailed Description of the Preferred Embodiments", state.detailed_description),
    ]

    numbered_sections = {}
    for name, title, content in section_defs:
        if not content.strip():
            sections.append(ApplicationSection(name=name, title=title, content="", paragraph_start=0))
            numbered_sections[name] = ""
            continue

        numbered, counter = _number_paragraphs(content, counter)
        sections.append(ApplicationSection(name=name, title=title, content=numbered, paragraph_start=counter - numbered.count("[0")))
        numbered_sections[name] = numbered

    # Claims don't get paragraph numbers
    sections.append(ApplicationSection(name="claims", title="Claims", content=state.claims_text, paragraph_start=0))

    # Abstract doesn't get paragraph numbers
    sections.append(ApplicationSection(name="abstract", title="Abstract of the Disclosure", content=state.abstract, paragraph_start=0))

    return ApplicationResult(
        title=state.invention_title,
        abstract=state.abstract,
        cross_references=numbered_sections.get("cross_references", ""),
        background=numbered_sections.get("background", ""),
        summary=numbered_sections.get("summary", ""),
        detailed_description=numbered_sections.get("detailed_description", ""),
        claims_text=state.claims_text,
        figure_descriptions=numbered_sections.get("figure_descriptions", ""),
        sections=sections,
        total_input_tokens=state.total_input_tokens,
        total_output_tokens=state.total_output_tokens,
        total_estimated_cost_usd=state.total_estimated_cost_usd,
        status="COMPLETE",
    )
