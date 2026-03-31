"""
Tests for the Examiner agent.
Mocks Anthropic SDK to verify state transitions and revision flag detection.
"""

from unittest.mock import AsyncMock, patch, MagicMock
import pytest

from src.agents.examiner import run_examiner
from src.models import GraphState


MOCK_FEEDBACK_NO_REVISION = """# Examination Report

## Claim 1 Analysis
Claim 1 is adequate for research purposes. Minor §112 concern with "actionable guidance" term.

## Overall Assessment
Quality: ADEQUATE
Top 3 issues: §101 risk on Claim 1, §103 combination risk, vague spec support.

REVISION_NEEDED: NO"""

MOCK_FEEDBACK_WITH_REVISION = """# Examination Report

## Claim 1 Analysis
CRITICAL: Claim 1 is anticipated by US10845342. Must add ML prediction limitation.

## Claim 8 Analysis
Claim 8 lacks antecedent basis for "the neural network model" — not introduced in preamble.

## Overall Assessment
Quality: NEEDS WORK
Top 3 issues: anticipation by prior art, missing antecedent basis, §101 risk.

REVISION_NEEDED: YES"""


def _make_mock_response(text: str):
    mock_content = MagicMock()
    mock_content.text = text
    mock_response = MagicMock()
    mock_response.content = [mock_content]
    return mock_response


class TestExaminerAgent:
    @pytest.mark.asyncio
    async def test_examiner_sets_no_revision_needed(self):
        state = GraphState(
            invention_narrative="A widget.",
            planner_strategy="Strategy.",
            draft_claims_raw="1. A method comprising: step a.",
            prior_art_context="US1234 - Prior Widget",
            api_key="test-key",
        )

        with patch("src.agents.examiner.anthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create = AsyncMock(
                return_value=_make_mock_response(MOCK_FEEDBACK_NO_REVISION),
            )
            mock_anthropic.AsyncAnthropic.return_value = mock_client

            result = await run_examiner(state)

        assert result.step == "examine_complete"
        assert result.needs_revision is False
        assert "ADEQUATE" in result.examiner_feedback

    @pytest.mark.asyncio
    async def test_examiner_sets_revision_needed(self):
        state = GraphState(
            invention_narrative="A widget.",
            planner_strategy="Strategy.",
            draft_claims_raw="1. A method comprising: step a.",
            prior_art_context="US1234 - Prior Widget",
            api_key="test-key",
        )

        with patch("src.agents.examiner.anthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create = AsyncMock(
                return_value=_make_mock_response(MOCK_FEEDBACK_WITH_REVISION),
            )
            mock_anthropic.AsyncAnthropic.return_value = mock_client

            result = await run_examiner(state)

        assert result.step == "examine_complete"
        assert result.needs_revision is True
        assert "NEEDS WORK" in result.examiner_feedback

    @pytest.mark.asyncio
    async def test_examiner_includes_prior_art_in_prompt(self):
        state = GraphState(
            invention_narrative="A widget.",
            draft_claims_raw="Claims here.",
            prior_art_context="US5555 - Important prior art patent",
            api_key="test-key",
        )

        with patch("src.agents.examiner.anthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create = AsyncMock(
                return_value=_make_mock_response(MOCK_FEEDBACK_NO_REVISION),
            )
            mock_anthropic.AsyncAnthropic.return_value = mock_client

            await run_examiner(state)

            call_kwargs = mock_client.messages.create.call_args.kwargs
            user_msg = call_kwargs["messages"][0]["content"]
            assert "US5555" in user_msg
            assert "Claims here." in user_msg

    @pytest.mark.asyncio
    async def test_examiner_handles_api_error(self):
        state = GraphState(
            invention_narrative="A widget.",
            draft_claims_raw="Claims.",
            api_key="bad-key",
        )

        with patch("src.agents.examiner.anthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create = AsyncMock(
                side_effect=Exception("Rate limited"),
            )
            mock_anthropic.AsyncAnthropic.return_value = mock_client

            result = await run_examiner(state)

        assert result.error is not None
        assert "Examiner failed" in result.error

    @pytest.mark.asyncio
    async def test_examiner_uses_default_model(self):
        state = GraphState(
            invention_narrative="A widget.",
            draft_claims_raw="Claims.",
            api_key="test-key",
            default_model="claude-opus-4-20250514",
        )

        with patch("src.agents.examiner.anthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create = AsyncMock(
                return_value=_make_mock_response(MOCK_FEEDBACK_NO_REVISION),
            )
            mock_anthropic.AsyncAnthropic.return_value = mock_client

            await run_examiner(state)

            call_kwargs = mock_client.messages.create.call_args.kwargs
            assert call_kwargs["model"] == "claude-opus-4-20250514"
