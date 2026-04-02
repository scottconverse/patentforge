"""
Figure Descriptions Agent — Generates the Brief Description of the Drawings.
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

    prompt_path = PROMPTS_DIR / "figure-descriptions.md"
    if prompt_path.exists():
        return common + prompt_path.read_text(encoding="utf-8")
    return common + "Generate the Brief Description of the Drawings."


async def run_figures(state: GraphState) -> GraphState:
    """Generate figure descriptions for the drawings section."""
    prompt = _load_prompt()

    user_message = f"""## Invention Title

{state.invention_title}

## Summary

{state.summary[:3000]}

## Detailed Description (excerpt)

{state.detailed_description[:5000]}

---

Generate the Brief Description of the Drawings (3-6 figures)."""

    client = anthropic.AsyncAnthropic(api_key=state.api_key)

    try:
        response = await client.messages.create(
            model=state.default_model,
            max_tokens=2000,
            system=prompt,
            messages=[{"role": "user", "content": user_message}],
            timeout=120.0,
        )
        state.figure_descriptions = response.content[0].text
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        state.total_input_tokens += input_tokens
        state.total_output_tokens += output_tokens
        state.total_estimated_cost_usd += estimate_cost(state.default_model, input_tokens, output_tokens)
    except Exception as e:
        state.error = f"Figure descriptions generation failed: {e}"
        return state

    state.step = "figures_complete"
    return state
