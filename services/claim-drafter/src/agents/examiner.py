"""
Examiner Agent — Critically reviews drafted claims against prior art.

Uses the default model.
Output: per-claim feedback, overall assessment, revision requests.
Determines whether claims need revision (one revision cycle max).
"""

from __future__ import annotations
from pathlib import Path

import anthropic

from ..models import GraphState

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt() -> str:
    common = ""
    common_path = PROMPTS_DIR / "common-rules.md"
    if common_path.exists():
        common = common_path.read_text(encoding="utf-8") + "\n\n"

    prompt_path = PROMPTS_DIR / "examiner.md"
    if prompt_path.exists():
        return common + prompt_path.read_text(encoding="utf-8")
    return common + "You are a critical patent examiner. Review claims for weaknesses."


async def run_examiner(state: GraphState) -> GraphState:
    """
    Review drafted claims against prior art and flag issues.
    Sets needs_revision=True if claims need work.
    """
    prompt = _load_prompt()
    claims_to_review = state.draft_claims_raw

    user_message = f"""## Drafted Claims

{claims_to_review}

## Prior Art Context

{state.prior_art_context}

## Invention Narrative

{state.invention_narrative}

## Planner Strategy

{state.planner_strategy}

---

Review these claims critically. For each claim:
1. Identify weaknesses (too broad, too narrow, §112 issues, prior art overlap)
2. Suggest specific improvements
3. Flag any claims that need revision

At the end, state clearly: REVISION_NEEDED: YES or REVISION_NEEDED: NO"""

    client = anthropic.AsyncAnthropic(api_key=state.api_key)

    try:
        response = await client.messages.create(
            model=state.default_model,
            max_tokens=state.max_tokens,
            system=prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        feedback = response.content[0].text
    except Exception as e:
        state.error = f"Examiner failed: {e}"
        return state

    state.examiner_feedback = feedback
    state.needs_revision = "REVISION_NEEDED: YES" in feedback.upper()
    state.step = "examine_complete"
    return state
