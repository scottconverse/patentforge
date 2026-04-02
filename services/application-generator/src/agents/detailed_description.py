"""
Detailed Description Agent — Generates the Detailed Description section.
This is the longest section and uses the most tokens.
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

    prompt_path = PROMPTS_DIR / "detailed-description.md"
    if prompt_path.exists():
        return common + prompt_path.read_text(encoding="utf-8")
    return common + "Generate the Detailed Description section."


async def run_detailed_description(state: GraphState) -> GraphState:
    """Generate the Detailed Description of the Preferred Embodiments."""
    prompt = _load_prompt()

    # Include all claims for enablement coverage
    claims_text = ""
    for c in state.claims:
        prefix = f"Claim {c.claim_number}"
        if c.claim_type == "DEPENDENT" and c.parent_claim_number:
            prefix += f" (depends on Claim {c.parent_claim_number})"
        claims_text += f"{prefix}: {c.text}\n\n"

    user_message = f"""## Invention Title

{state.invention_title}

## Background (generated)

{state.background}

## Summary (generated)

{state.summary}

## Specification Language (from claim drafter)

{state.specification_language}

## Comprehensive Report (Feasibility Stage 6)

{state.feasibility_stage_6[:30000]}

## All Claims (must be supported)

{claims_text or "(No claims available)"}

## Invention Narrative

{state.invention_narrative}

---

Generate the Detailed Description of the Preferred Embodiments. Ensure EVERY claim element is described and supported."""

    client = anthropic.AsyncAnthropic(api_key=state.api_key)

    try:
        response = await client.messages.create(
            model=state.default_model,
            max_tokens=min(state.max_tokens, 32000),  # Cap — this section is long
            system=prompt,
            messages=[{"role": "user", "content": user_message}],
            timeout=600.0,  # 10 min — longest section
        )
        state.detailed_description = response.content[0].text
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        state.total_input_tokens += input_tokens
        state.total_output_tokens += output_tokens
        state.total_estimated_cost_usd += estimate_cost(state.default_model, input_tokens, output_tokens)
    except Exception as e:
        state.error = f"Detailed description generation failed: {e}"
        return state

    state.step = "detailed_description_complete"
    return state
