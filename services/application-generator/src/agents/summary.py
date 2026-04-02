"""
Summary Agent — Generates the Summary of the Invention section.
"""

from __future__ import annotations
from pathlib import Path

import anthropic

from ..models import GraphState
from ..cost import estimate_cost

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt() -> str:
    common = ""
    common_path = PROMPTS_DIR / "common-rules.md"
    if common_path.exists():
        common = common_path.read_text(encoding="utf-8") + "\n\n"

    prompt_path = PROMPTS_DIR / "summary.md"
    if prompt_path.exists():
        return common + prompt_path.read_text(encoding="utf-8")
    return common + "Generate the Summary of the Invention section."


async def run_summary(state: GraphState) -> GraphState:
    """Generate the Summary of the Invention section."""
    prompt = _load_prompt()

    # Build claims overview for context
    claims_overview = ""
    for c in state.claims:
        if c.claim_type == "INDEPENDENT":
            claims_overview += f"Independent Claim {c.claim_number}: {c.text[:500]}\n\n"

    user_message = f"""## Invention Title

{state.invention_title}

## Background (just generated)

{state.background}

## IP Strategy & Recommendations (Feasibility Stage 5)

{state.feasibility_stage_5}

## Independent Claims Overview

{claims_overview or "(No claims available)"}

## Invention Narrative

{state.invention_narrative}

---

Generate the Summary of the Invention section."""

    client = anthropic.AsyncAnthropic(api_key=state.api_key)

    try:
        response = await client.messages.create(
            model=state.default_model,
            max_tokens=state.max_tokens,
            system=prompt,
            messages=[{"role": "user", "content": user_message}],
            timeout=300.0,
        )
        state.summary = response.content[0].text
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        state.total_input_tokens += input_tokens
        state.total_output_tokens += output_tokens
        state.total_estimated_cost_usd += estimate_cost(state.default_model, input_tokens, output_tokens)
    except Exception as e:
        state.error = f"Summary generation failed: {e}"
        return state

    state.step = "summary_complete"
    return state
