"""Tests for the USPTO formatter — paragraph numbering, claims formatting, assembly."""

from src.formatter import _number_paragraphs, _format_claims, assemble, build_application_result
from src.models import GraphState, ClaimItem


class TestNumberParagraphs:
    def test_basic_numbering(self):
        text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
        result, next_num = _number_paragraphs(text, 1)
        assert "[0001] First paragraph." in result
        assert "[0002] Second paragraph." in result
        assert "[0003] Third paragraph." in result
        assert next_num == 4

    def test_start_from_offset(self):
        text = "A paragraph."
        result, next_num = _number_paragraphs(text, 42)
        assert "[0042] A paragraph." in result
        assert next_num == 43

    def test_empty_text(self):
        result, next_num = _number_paragraphs("", 1)
        assert result == ""
        assert next_num == 1

    def test_whitespace_only(self):
        result, next_num = _number_paragraphs("   \n\n   ", 1)
        assert result == ""
        assert next_num == 1

    def test_skips_claim_lines(self):
        text = "1. A method for doing something.\n\n2. The method of claim 1."
        result, next_num = _number_paragraphs(text, 1)
        # Claim lines should NOT get paragraph numbers
        assert "[0001]" not in result
        assert "1. A method" in result
        assert next_num == 1  # No paragraphs numbered

    def test_skips_what_is_claimed(self):
        text = "What is claimed is:\n\nSome claim text."
        result, next_num = _number_paragraphs(text, 1)
        assert "What is claimed is:" in result
        # "Some claim text." doesn't start with a digit, so it gets numbered
        assert "[0001] Some claim text." in result

    def test_four_digit_format(self):
        text = "A paragraph."
        result, _ = _number_paragraphs(text, 9999)
        assert "[9999]" in result

    def test_sequential_across_sections(self):
        text1 = "Para 1.\n\nPara 2."
        text2 = "Para 3.\n\nPara 4."
        _, next1 = _number_paragraphs(text1, 1)
        result2, next2 = _number_paragraphs(text2, next1)
        assert "[0003] Para 3." in result2
        assert "[0004] Para 4." in result2
        assert next2 == 5


class TestFormatClaims:
    def test_basic_claims(self):
        claims = [
            ClaimItem(claim_number=1, claim_type="INDEPENDENT", text="A method for X."),
            ClaimItem(claim_number=2, claim_type="DEPENDENT", parent_claim_number=1, text="The method of claim 1, further comprising Y."),
        ]
        result = _format_claims(claims)
        assert "What is claimed is:" in result
        assert "1. A method for X." in result
        assert "2. The method of claim 1" in result

    def test_empty_claims(self):
        assert _format_claims([]) == ""

    def test_no_duplicate_numbering(self):
        claims = [ClaimItem(claim_number=1, claim_type="INDEPENDENT", text="1. A method for X.")]
        result = _format_claims(claims)
        # Should not produce "1. 1. A method"
        assert "1. 1." not in result
        assert "1. A method for X." in result


class TestAssemble:
    def test_assemble_sets_claims_text(self):
        state = GraphState(
            invention_title="Test",
            claims=[
                ClaimItem(claim_number=1, claim_type="INDEPENDENT", text="A system."),
            ],
            prior_art_context="**US1234** — Some patent",
        )
        result = assemble(state)
        assert "What is claimed is:" in result.claims_text
        assert result.step == "assemble_complete"

    def test_assemble_sets_cross_references(self):
        state = GraphState(
            invention_title="Test",
            prior_art_context="**US1234** — Some patent\nAbstract: blah",
        )
        result = assemble(state)
        assert "US1234" in result.cross_references

    def test_assemble_empty_prior_art(self):
        state = GraphState(
            invention_title="Test",
            prior_art_context="(No prior art results available)",
        )
        result = assemble(state)
        assert result.cross_references == ""


class TestBuildApplicationResult:
    def test_full_result(self):
        state = GraphState(
            invention_title="Widget System",
            background="Background paragraph 1.\n\nBackground paragraph 2.",
            summary="Summary paragraph.",
            detailed_description="Detailed paragraph 1.\n\nDetailed paragraph 2.\n\nDetailed paragraph 3.",
            abstract="A system for widgets that does things.",
            figure_descriptions="FIG. 1 is a block diagram.",
            claims_text="What is claimed is:\n\n1. A widget system.",
            cross_references="**US1234** — Prior widget",
            total_input_tokens=5000,
            total_output_tokens=3000,
            total_estimated_cost_usd=0.06,
        )
        result = build_application_result(state)

        assert result.title == "Widget System"
        assert result.status == "COMPLETE"
        # Cross-references get [0001], so background starts at [0002]
        assert "[0002]" in result.background
        assert "[0003]" in result.background
        assert result.total_input_tokens == 5000
        assert result.total_output_tokens == 3000
        assert len(result.sections) == 7  # cross_ref, bg, summary, figures, detailed, claims, abstract

    def test_paragraph_numbers_sequential_across_sections(self):
        state = GraphState(
            invention_title="Test",
            background="BG para.",
            summary="Sum para.",
            detailed_description="Detail para.",
            figure_descriptions="FIG. 1 is a diagram.",
            abstract="Abstract text.",
            claims_text="",
            cross_references="Cross ref.",
        )
        result = build_application_result(state)

        # Cross-ref gets [0001], bg gets [0002], summary gets [0003], etc.
        assert "[0001]" in result.cross_references
        assert "[0002]" in result.background
        assert "[0003]" in result.summary

    def test_empty_sections_skipped(self):
        state = GraphState(
            invention_title="Test",
            background="BG para.",
            summary="",
            detailed_description="",
            abstract="Abstract.",
            claims_text="",
            cross_references="",
            figure_descriptions="",
        )
        result = build_application_result(state)
        assert result.background != ""
        assert result.summary == ""
