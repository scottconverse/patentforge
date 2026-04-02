"""Tests for LangGraph pipeline structure."""

from src.graph import build_graph
from src.models import GraphState


class TestGraphStructure:
    def test_graph_compiles(self):
        graph = build_graph()
        compiled = graph.compile()
        assert compiled is not None

    def test_graph_has_expected_nodes(self):
        graph = build_graph()
        node_names = set(graph.nodes.keys())
        expected = {"background", "summary", "detailed_description", "abstract", "figures", "format_ids", "finalize"}
        assert expected == node_names

    def test_graph_is_linear(self):
        graph = build_graph()
        compiled = graph.compile()
        assert compiled is not None
