"""
Abstract Agent — Generates the Abstract of the Disclosure.
Must be 150 words or fewer per USPTO requirements.
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

    prompt_path = PROMPTS_DIR / "abstract.md"
    if prompt_path.exists():
        return common + prompt_path.read_text(encoding="utf-8")
    return common + "Generate the Abstract of the Disclosure (150 words max)."


async def run_abstract(state: GraphState) -> GraphState:
    """Generate the Abstract (150 words max)."""
    prompt = _load_prompt()

    # Build concise claims summary
    independent_claims = [c for c in state.claims if c.claim_type == "INDEPENDENT"]
    claims_summary = "\n".join(f"- {c.text[:300]}" for c in independent_claims[:3])

    user_message = f"""## Invention Title

{state.invention_title}

## Summary (generated)

{state.summary}

## Independent Claims

{claims_summary or "(No claims available)"}

## Technical Intake (Feasibility Stage 1)

{state.feasibility_stage_1[:5000]}

---

Generate the Abstract of the Disclosure. MUST be 150 words or fewer, single paragraph."""

    client = anthropic.AsyncAnthropic(api_key=state.api_key)

    try:
        response = await client.messages.create(
            model=state.default_model,
            max_tokens=1000,  # Abstract is short
            system=prompt,
            messages=[{"role": "user", "content": user_message}],
            timeout=120.0,
        )
        state.abstract = response.content[0].text
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        state.total_input_tokens += input_tokens
        state.total_output_tokens += output_tokens
        state.total_estimated_cost_usd += estimate_cost(state.default_model, input_tokens, output_tokens)
    except Exception as e:
        state.error = f"Abstract generation failed: {e}"
        return state

    state.step = "abstract_complete"
    return state
