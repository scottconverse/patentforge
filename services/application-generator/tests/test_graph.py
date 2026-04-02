"""Tests for the application generation pipeline with mocked LLM calls."""

from unittest.mock import AsyncMock, patch, MagicMock
import pytest

from src.graph import run_application_pipeline
from src.models import ClaimItem


def _mock_anthropic_response(text: str, input_tokens: int = 100, output_tokens: int = 200):
    """Create a mock Anthropic API response."""
    response = MagicMock()
    response.content = [MagicMock(text=text)]
    response.usage = MagicMock(input_tokens=input_tokens, output_tokens=output_tokens)
    return response


@pytest.mark.asyncio
async def test_pipeline_completes_with_all_sections():
    """Test that the pipeline produces all sections when LLM calls succeed."""
    mock_responses = {
        "background": _mock_anthropic_response("The field of widget technology has evolved significantly."),
        "summary": _mock_anthropic_response("The present invention provides a novel widget system."),
        "detailed_description": _mock_anthropic_response("In one embodiment, the system comprises a processor (102)."),
        "abstract": _mock_anthropic_response("A widget system for processing data efficiently."),
        "figures": _mock_anthropic_response("FIG. 1 is a block diagram illustrating the widget system."),
    }

    call_count = 0

    async def mock_create(**kwargs):
        nonlocal call_count
        # Return responses in order of pipeline execution
        keys = list(mock_responses.keys())
        key = keys[min(call_count, len(keys) - 1)]
        call_count += 1
        return mock_responses[key]

    mock_client = MagicMock()
    mock_client.messages.create = mock_create

    with patch("src.agents.background.anthropic.AsyncAnthropic", return_value=mock_client), \
         patch("src.agents.summary.anthropic.AsyncAnthropic", return_value=mock_client), \
         patch("src.agents.detailed_description.anthropic.AsyncAnthropic", return_value=mock_client), \
         patch("src.agents.abstract_gen.anthropic.AsyncAnthropic", return_value=mock_client), \
         patch("src.agents.figures.anthropic.AsyncAnthropic", return_value=mock_client):

        result = await run_application_pipeline(
            invention_title="Widget System",
            invention_narrative="A system for processing widgets efficiently.",
            feasibility_stage_1="Stage 1 output",
            feasibility_stage_5="Stage 5 output",
            feasibility_stage_6="Stage 6 output",
            claims=[
                {"claim_number": 1, "claim_type": "INDEPENDENT", "text": "A widget system comprising a processor."},
            ],
            specification_language="The widget system includes a processor for data.",
            prior_art_context="(No prior art results available)",
            compliance_passed=True,
            api_key="test-key",
            default_model="claude-sonnet-4-20250514",
            max_tokens=4000,
        )

    assert result.status == "COMPLETE"
    assert result.title == "Widget System"
    assert result.background != ""
    assert result.summary != ""
    assert result.detailed_description != ""
    assert result.abstract != ""
    assert result.figure_descriptions != ""
    assert result.claims_text != ""
    assert "What is claimed is:" in result.claims_text
    assert result.total_input_tokens > 0
    assert result.total_output_tokens > 0
    assert len(result.sections) == 7


@pytest.mark.asyncio
async def test_pipeline_returns_error_on_llm_failure():
    """Test that the pipeline returns ERROR status when an LLM call fails."""
    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(side_effect=Exception("API rate limited"))

    with patch("src.agents.background.anthropic.AsyncAnthropic", return_value=mock_client):
        result = await run_application_pipeline(
            invention_title="Test",
            invention_narrative="Test narrative",
            feasibility_stage_1="",
            feasibility_stage_5="",
            feasibility_stage_6="",
            claims=[],
            specification_language="",
            prior_art_context="",
            compliance_passed=True,
            api_key="test-key",
            default_model="claude-sonnet-4-20250514",
        )

    assert result.status == "ERROR"
    assert "Background generation failed" in result.error_message


@pytest.mark.asyncio
async def test_pipeline_tracks_cost():
    """Test that cost tracking accumulates across all agents."""
    async def mock_create(**kwargs):
        return _mock_anthropic_response("Some output", input_tokens=1000, output_tokens=500)

    mock_client = MagicMock()
    mock_client.messages.create = mock_create

    with patch("src.agents.background.anthropic.AsyncAnthropic", return_value=mock_client), \
         patch("src.agents.summary.anthropic.AsyncAnthropic", return_value=mock_client), \
         patch("src.agents.detailed_description.anthropic.AsyncAnthropic", return_value=mock_client), \
         patch("src.agents.abstract_gen.anthropic.AsyncAnthropic", return_value=mock_client), \
         patch("src.agents.figures.anthropic.AsyncAnthropic", return_value=mock_client):

        result = await run_application_pipeline(
            invention_title="Test",
            invention_narrative="Test",
            feasibility_stage_1="",
            feasibility_stage_5="",
            feasibility_stage_6="",
            claims=[],
            specification_language="",
            prior_art_context="",
            compliance_passed=True,
            api_key="test-key",
            default_model="claude-sonnet-4-20250514",
        )

    assert result.status == "COMPLETE"
    # 5 agents × 1000 input tokens = 5000
    assert result.total_input_tokens == 5000
    # 5 agents × 500 output tokens = 2500
    assert result.total_output_tokens == 2500
    assert result.total_estimated_cost_usd > 0


@pytest.mark.asyncio
async def test_on_step_callback():
    """Test that on_step callback is called for each pipeline node."""
    async def mock_create(**kwargs):
        return _mock_anthropic_response("Output")

    mock_client = MagicMock()
    mock_client.messages.create = mock_create

    steps = []

    with patch("src.agents.background.anthropic.AsyncAnthropic", return_value=mock_client), \
         patch("src.agents.summary.anthropic.AsyncAnthropic", return_value=mock_client), \
         patch("src.agents.detailed_description.anthropic.AsyncAnthropic", return_value=mock_client), \
         patch("src.agents.abstract_gen.anthropic.AsyncAnthropic", return_value=mock_client), \
         patch("src.agents.figures.anthropic.AsyncAnthropic", return_value=mock_client):

        result = await run_application_pipeline(
            invention_title="Test",
            invention_narrative="Test",
            feasibility_stage_1="",
            feasibility_stage_5="",
            feasibility_stage_6="",
            claims=[],
            specification_language="",
            prior_art_context="",
            compliance_passed=True,
            api_key="test-key",
            default_model="claude-sonnet-4-20250514",
            on_step=lambda name, step: steps.append(name),
        )

    assert result.status == "COMPLETE"
    # Should have steps for: background, summary, detailed_description, abstract, figures, assemble
    assert len(steps) >= 5
    assert "background" in steps
    assert "assemble" in steps
