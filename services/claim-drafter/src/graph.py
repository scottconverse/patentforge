"""
LangGraph state machine for the claim drafting pipeline.

Flow: plan → draft → examine → (revise if needed) → finalize
"""

from __future__ import annotations
from typing import Literal

from langgraph.graph import StateGraph, END

from .models import GraphState, ClaimDraftResult
from .agents.planner import run_planner
from .agents.writer import run_writer
from .agents.examiner import run_examiner
from .parser import parse_claims


async def finalize(state: GraphState) -> GraphState:
    """
    Parse the final claims text into structured Claim objects.
    Uses revised claims if available, otherwise the original draft.
    """
    raw = state.revised_claims_raw or state.draft_claims_raw
    state.claims = parse_claims(raw)
    state.step = "finalize_complete"
    return state


def should_revise(state: GraphState) -> Literal["revise", "finalize"]:
    """Conditional edge: revise if examiner says so, otherwise finalize."""
    if state.needs_revision and not state.revised_claims_raw:
        return "revise"
    return "finalize"


def build_graph() -> StateGraph:
    """Build the LangGraph claim drafting pipeline."""
    graph = StateGraph(GraphState)

    # Add nodes
    graph.add_node("plan", run_planner)
    graph.add_node("draft", run_writer)
    graph.add_node("examine", run_examiner)
    graph.add_node("revise", run_writer)  # Same agent, revision mode
    graph.add_node("finalize", finalize)

    # Add edges
    graph.set_entry_point("plan")
    graph.add_edge("plan", "draft")
    graph.add_edge("draft", "examine")
    graph.add_conditional_edges("examine", should_revise)
    graph.add_edge("revise", "finalize")
    graph.add_edge("finalize", END)

    return graph


# Compiled graph (reused across requests)
claim_pipeline = build_graph().compile()


async def run_claim_pipeline(
    invention_narrative: str,
    feasibility_stage_5: str,
    feasibility_stage_6: str,
    prior_art_context: str,
    api_key: str,
    default_model: str = "claude-sonnet-4-20250514",
    research_model: str = "",
    max_tokens: int = 16000,
    on_step: callable | None = None,
) -> ClaimDraftResult:
    """
    Run the full claim drafting pipeline and return structured results.

    Args:
        on_step: Optional callback called after each step with (step_name, state).
    """
    initial_state = GraphState(
        invention_narrative=invention_narrative,
        feasibility_stage_5=feasibility_stage_5,
        feasibility_stage_6=feasibility_stage_6,
        prior_art_context=prior_art_context,
        api_key=api_key,
        default_model=default_model,
        research_model=research_model,
        max_tokens=max_tokens,
    )

    state = initial_state
    async for step_output in claim_pipeline.astream(state):
        # LangGraph yields {node_name: state} after each step
        for node_name, node_state in step_output.items():
            state = node_state
            if on_step:
                on_step(node_name, state)
            if state.error:
                return ClaimDraftResult(
                    status="ERROR",
                    error_message=state.error,
                    planner_strategy=state.planner_strategy,
                    examiner_feedback=state.examiner_feedback,
                    total_input_tokens=state.total_input_tokens,
                    total_output_tokens=state.total_output_tokens,
                    total_estimated_cost_usd=state.total_estimated_cost_usd,
                )

    return ClaimDraftResult(
        claims=state.claims,
        claim_count=len(state.claims),
        specification_language=state.specification_language,
        planner_strategy=state.planner_strategy,
        examiner_feedback=state.examiner_feedback,
        revision_notes=state.revision_notes,
        total_input_tokens=state.total_input_tokens,
        total_output_tokens=state.total_output_tokens,
        total_estimated_cost_usd=state.total_estimated_cost_usd,
        status="COMPLETE",
    )
