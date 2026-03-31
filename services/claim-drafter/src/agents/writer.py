"""
Writer Agent — Drafts patent claims following the Planner's strategy.

Uses the default model (main creative work).
Output: 3 independent claims (broad/medium/narrow) + dependent claims, capped at 20 total.
"""

from __future__ import annotations
from pathlib import Path

import anthropic

from ..models import GraphState

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "writer.md"


def _load_prompt() -> str:
    if PROMPT_PATH.exists():
        return PROMPT_PATH.read_text(encoding="utf-8")
    return "You are a patent claim writer. Draft claims following the strategy provided."


async def run_writer(state: GraphState) -> GraphState:
    """
    Draft claims based on the planner's strategy.
    On revision pass, incorporates examiner feedback.
    """
    prompt = _load_prompt()
    is_revision = state.needs_revision and state.examiner_feedback

    if is_revision:
        user_message = f"""## Planner Strategy

{state.planner_strategy}

## Previous Draft

{state.draft_claims_raw}

## Examiner Feedback (REVISE BASED ON THIS)

{state.examiner_feedback}

---

Revise the claims based on the examiner's feedback. Keep the same structure and numbering where possible."""
    else:
        user_message = f"""## Invention Narrative

{state.invention_narrative}

## Planner Strategy

{state.planner_strategy}

## Prior Art Context

{state.prior_art_context}

---

Draft the claims following the planner's strategy. Maximum 20 total claims."""

    client = anthropic.AsyncAnthropic(api_key=state.api_key)

    try:
        response = await client.messages.create(
            model=state.default_model,
            max_tokens=state.max_tokens,
            system=prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        claims_text = response.content[0].text
    except Exception as e:
        state.error = f"Writer failed: {e}"
        return state

    if is_revision:
        state.revised_claims_raw = claims_text
        state.revision_notes = "Claims revised based on examiner feedback."
        state.step = "revise_complete"
    else:
        state.draft_claims_raw = claims_text
        state.step = "draft_complete"

    return state
