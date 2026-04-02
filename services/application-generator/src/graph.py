"""
LangGraph state machine for the application generation pipeline.

Flow: background → summary → detailed_description → abstract → figures → assemble → END
"""

from __future__ import annotations
from typing import Callable

from langgraph.graph import StateGraph, END

from .models import GraphState, ApplicationResult
from .agents.background import run_background
from .agents.summary import run_summary
from .agents.detailed_description import run_detailed_description
from .agents.abstract_gen import run_abstract
from .agents.figures import run_figures
from .formatter import assemble, build_application_result


def build_graph() -> StateGraph:
    """Build the LangGraph application generation pipeline."""
    graph = StateGraph(GraphState)

    graph.add_node("background", run_background)
    graph.add_node("summary", run_summary)
    graph.add_node("detailed_description", run_detailed_description)
    graph.add_node("abstract", run_abstract)
    graph.add_node("figures", run_figures)
    graph.add_node("assemble", assemble)

    graph.set_entry_point("background")
    graph.add_edge("background", "summary")
    graph.add_edge("summary", "detailed_description")
    graph.add_edge("detailed_description", "abstract")
    graph.add_edge("abstract", "figures")
    graph.add_edge("figures", "assemble")
    graph.add_edge("assemble", END)

    return graph


# Compiled graph (reused across requests)
application_pipeline = build_graph().compile()


async def run_application_pipeline(
    invention_title: str,
    invention_narrative: str,
    feasibility_stage_1: str,
    feasibility_stage_5: str,
    feasibility_stage_6: str,
    claims: list,
    specification_language: str,
    prior_art_context: str,
    compliance_passed: bool,
    api_key: str,
    default_model: str = "claude-sonnet-4-20250514",
    max_tokens: int = 16000,
    on_step: Callable[[str, str], None] | None = None,
) -> ApplicationResult:
    """Run the full application generation pipeline."""
    from .models import ClaimItem

    # Convert claim dicts to ClaimItem objects if needed
    parsed_claims = []
    for c in claims:
        if isinstance(c, dict):
            parsed_claims.append(ClaimItem(**c))
        else:
            parsed_claims.append(c)

    initial_state = GraphState(
        invention_title=invention_title,
        invention_narrative=invention_narrative,
        feasibility_stage_1=feasibility_stage_1,
        feasibility_stage_5=feasibility_stage_5,
        feasibility_stage_6=feasibility_stage_6,
        claims=parsed_claims,
        specification_language=specification_language,
        prior_art_context=prior_art_context,
        compliance_passed=compliance_passed,
        api_key=api_key,
        default_model=default_model,
        max_tokens=max_tokens,
    )

    state_dict: dict = initial_state.model_dump()
    async for step_output in application_pipeline.astream(state_dict):
        for node_name, node_state in step_output.items():
            if isinstance(node_state, dict):
                state_dict = node_state
            else:
                state_dict = node_state.model_dump() if hasattr(node_state, 'model_dump') else dict(node_state)
            if on_step:
                on_step(node_name, state_dict.get("step", ""))
            if state_dict.get("error"):
                return ApplicationResult(
                    title=invention_title,
                    status="ERROR",
                    error_message=state_dict["error"],
                    total_input_tokens=state_dict.get("total_input_tokens", 0),
                    total_output_tokens=state_dict.get("total_output_tokens", 0),
                    total_estimated_cost_usd=state_dict.get("total_estimated_cost_usd", 0.0),
                )

    # Reconstruct state for final assembly
    final_state = GraphState(**state_dict)
    final_state.api_key = ""  # Scrub
    return build_application_result(final_state)
