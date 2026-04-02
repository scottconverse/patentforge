"""
Background Agent — Generates the Background of the Invention section.
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

    prompt_path = PROMPTS_DIR / "background.md"
    if prompt_path.exists():
        return common + prompt_path.read_text(encoding="utf-8")
    return common + "Generate the Background of the Invention section."


async def run_background(state: GraphState) -> GraphState:
    """Generate the Background of the Invention section."""
    prompt = _load_prompt()

    user_message = f"""## Invention Title

{state.invention_title}

## Technical Intake & Restatement (Feasibility Stage 1)

{state.feasibility_stage_1}

## Invention Narrative

{state.invention_narrative}

## Prior Art Context

{state.prior_art_context}

---

Generate the Background of the Invention section."""

    client = anthropic.AsyncAnthropic(api_key=state.api_key)

    try:
        response = await client.messages.create(
            model=state.default_model,
            max_tokens=state.max_tokens,
            system=prompt,
            messages=[{"role": "user", "content": user_message}],
            timeout=300.0,
        )
        state.background = response.content[0].text
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        state.total_input_tokens += input_tokens
        state.total_output_tokens += output_tokens
        state.total_estimated_cost_usd += estimate_cost(state.default_model, input_tokens, output_tokens)
    except Exception as e:
        state.error = f"Background generation failed: {e}"
        return state

    state.step = "background_complete"
    return state
