"""Tests for DOCX and Markdown export."""

from src.exporter import export_docx, export_markdown
from src.models import ExportRequest


def _sample_request() -> ExportRequest:
    return ExportRequest(
        title="Widget Manufacturing System",
        cross_references="",
        background="[0001] The field of widget manufacturing has grown.\n\n[0002] Existing methods are slow.",
        summary="[0003] The present invention provides a faster widget system.",
        detailed_description="[0004] In a preferred embodiment, the system comprises a hopper.",
        claims="1. A method of manufacturing widgets comprising a hopper and a conveyor.",
        abstract="[0005] A widget manufacturing system with improved throughput.",
        figure_descriptions="[0006] FIG. 1 is a block diagram showing the widget system.",
        ids_table="| Ref | Patent Number | Title |\n|-----|-------------|-------|\n| 1 | US10123456 | Old Widget |",
    )


class TestDocxExport:
    def test_produces_bytes(self):
        result = export_docx(_sample_request())
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:2] == b"PK"

    def test_empty_sections_handled(self):
        req = ExportRequest(title="Minimal", claims="1. A method.")
        result = export_docx(req)
        assert isinstance(result, bytes)
        assert len(result) > 0


class TestMarkdownExport:
    def test_produces_string(self):
        result = export_markdown(_sample_request())
        assert isinstance(result, str)
        assert "Widget Manufacturing System" in result
        assert "## Background" in result or "Background of the Invention" in result
        assert "## Claims" in result or "Claims" in result

    def test_includes_ids_table(self):
        result = export_markdown(_sample_request())
        assert "Information Disclosure Statement" in result
        assert "US10123456" in result

    def test_empty_sections_omitted(self):
        req = ExportRequest(title="Minimal", claims="1. A method.")
        result = export_markdown(req)
        assert "Claims" in result
        assert "Background" not in result
