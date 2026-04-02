"""Tests for export functionality — Markdown, DOCX, PDF."""

from src.exporter import export_markdown, export_docx
from src.models import ApplicationResult


def _sample_result() -> ApplicationResult:
    return ApplicationResult(
        title="Widget System",
        abstract="A system for widgets.",
        cross_references="[0001] US1234 — Prior widget",
        background="[0002] The field of widgets.\n\n[0003] Existing systems lack X.",
        summary="[0004] The present invention provides a widget system.",
        detailed_description="[0005] In one embodiment, the system comprises a processor.",
        claims_text="What is claimed is:\n\n1. A widget system comprising a processor.",
        figure_descriptions="[0006] FIG. 1 is a block diagram.",
        status="COMPLETE",
    )


class TestExportMarkdown:
    def test_contains_all_sections(self):
        md = export_markdown(_sample_result())
        assert "# Widget System" in md
        assert "## Background of the Invention" in md
        assert "## Summary of the Invention" in md
        assert "## Detailed Description" in md
        assert "## Claims" in md
        assert "## Abstract of the Disclosure" in md
        assert "## Brief Description of the Drawings" in md
        assert "## Cross-Reference to Related Applications" in md

    def test_contains_content(self):
        md = export_markdown(_sample_result())
        assert "[0002] The field of widgets." in md
        assert "A system for widgets." in md
        assert "1. A widget system" in md

    def test_empty_cross_references_omitted(self):
        result = _sample_result()
        result.cross_references = ""
        md = export_markdown(result)
        assert "Cross-Reference" not in md


class TestExportDocx:
    def test_returns_bytes(self):
        doc_bytes = export_docx(_sample_result())
        assert isinstance(doc_bytes, bytes)
        assert len(doc_bytes) > 0
        # DOCX files start with PK (zip header)
        assert doc_bytes[:2] == b'PK'

    def test_not_empty_for_minimal_input(self):
        result = ApplicationResult(
            title="Minimal",
            abstract="An abstract.",
            background="A background.",
            summary="",
            detailed_description="",
            claims_text="",
            figure_descriptions="",
            status="COMPLETE",
        )
        doc_bytes = export_docx(result)
        assert len(doc_bytes) > 100
