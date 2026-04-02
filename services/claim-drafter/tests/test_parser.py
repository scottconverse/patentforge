"""
Tests for the claim text parser.
Verifies extraction of claim numbers, types, scope levels, and dependencies.
"""

from src.parser import parse_claims


class TestParseClaimsBasic:
    def test_parses_numbered_claims(self):
        raw = """1. A method comprising: step a; and step b.

2. The method of claim 1, wherein step a uses a processor."""

        claims = parse_claims(raw)
        assert len(claims) == 2
        assert claims[0].claim_number == 1
        assert claims[1].claim_number == 2

    def test_identifies_independent_claims(self):
        raw = "1. (Independent - Broad - Method) A method comprising: receiving input."
        claims = parse_claims(raw)
        assert claims[0].claim_type == "INDEPENDENT"
        assert claims[0].scope_level == "BROAD"
        assert claims[0].statutory_type == "method"

    def test_identifies_dependent_claims_by_annotation(self):
        raw = "5. (Dependent on 1) The method of claim 1, wherein the input is digital."
        claims = parse_claims(raw)
        assert claims[0].claim_type == "DEPENDENT"
        assert claims[0].parent_claim_number == 1

    def test_identifies_dependent_claims_by_text_pattern(self):
        raw = "3. The system of claim 2, further comprising a memory module."
        claims = parse_claims(raw)
        assert claims[0].claim_type == "DEPENDENT"
        assert claims[0].parent_claim_number == 2

    def test_parses_all_scope_levels(self):
        raw = """1. (Independent - Broad - Method) A method.

7. (Independent - Medium - System) A system.

14. (Independent - Narrow - CRM) A non-transitory computer-readable medium."""

        claims = parse_claims(raw)
        assert claims[0].scope_level == "BROAD"
        assert claims[1].scope_level == "MEDIUM"
        assert claims[2].scope_level == "NARROW"

    def test_parses_statutory_types(self):
        raw = """1. (Independent - Broad - Method) A method.

7. (Independent - Medium - System) A system.

14. (Independent - Narrow - CRM) A medium."""

        claims = parse_claims(raw)
        assert claims[0].statutory_type == "method"
        assert claims[1].statutory_type == "system"
        assert claims[2].statutory_type == "crm"

    def test_handles_multiline_claim_text(self):
        raw = """1. (Independent - Broad - Method) A method comprising:
   receiving, by a processor, input data from a sensor array;
   processing the input data using a neural network model; and
   transmitting processed results to a display device."""

        claims = parse_claims(raw)
        assert len(claims) == 1
        assert "receiving" in claims[0].text
        assert "transmitting" in claims[0].text

    def test_strips_metadata_from_claim_text(self):
        raw = "1. (Independent - Broad - Method) A method comprising: step a."
        claims = parse_claims(raw)
        assert claims[0].text.startswith("A method")
        assert "Independent" not in claims[0].text

    def test_returns_empty_for_empty_input(self):
        assert parse_claims("") == []
        assert parse_claims("No claims here, just text.") == []

    def test_handles_claim_keyword_prefix(self):
        raw = "Claim 1. A method comprising: doing something."
        claims = parse_claims(raw)
        assert len(claims) == 1
        assert claims[0].claim_number == 1


class TestParseClaimsComplex:
    def test_full_claim_set(self):
        raw = """1. (Independent - Broad - Method) A method for processing sensor data comprising:
   receiving data from a plurality of sensors;
   aggregating the data into a unified dataset; and
   generating an alert based on the unified dataset.

2. (Dependent on 1) The method of claim 1, wherein the plurality of sensors comprises at least three temperature sensors.

3. (Dependent on 1) The method of claim 1, wherein generating the alert comprises sending a notification to a mobile device.

4. (Dependent on 2) The method of claim 2, further comprising calibrating each temperature sensor before receiving data.

5. (Independent - Medium - System) A system comprising:
   a sensor array having a plurality of sensors;
   a processor operatively coupled to the sensor array; and
   a memory storing instructions that, when executed by the processor, cause the processor to aggregate sensor data and generate alerts.

6. (Dependent on 5) The system of claim 5, wherein the sensor array comprises wireless sensors communicating via a mesh network.

7. (Independent - Narrow - CRM) A non-transitory computer-readable medium storing instructions that, when executed by a processor, cause the processor to:
   receive temperature data from at least three sensors;
   calculate a weighted average of the temperature data;
   compare the weighted average to a predetermined threshold; and
   transmit an alert message when the weighted average exceeds the threshold."""

        claims = parse_claims(raw)

        # Total claims
        assert len(claims) == 7

        # Independent claims
        indep = [c for c in claims if c.claim_type == "INDEPENDENT"]
        assert len(indep) == 3

        # Dependent claims
        deps = [c for c in claims if c.claim_type == "DEPENDENT"]
        assert len(deps) == 4

        # Scope levels on independents
        scopes = {c.scope_level for c in indep}
        assert scopes == {"BROAD", "MEDIUM", "NARROW"}

        # Statutory types
        types = {c.statutory_type for c in indep}
        assert "method" in types
        assert "system" in types
        assert "crm" in types

        # Dependency chain
        claim4 = next(c for c in claims if c.claim_number == 4)
        assert claim4.parent_claim_number == 2

    def test_duplicate_numbering_renumbered_sequentially(self):
        """Haiku sometimes outputs multiple claims with the same number."""
        raw = """1. (Independent - Broad - Method) A method for connecting frames.

1. (Independent - Medium - System) A system comprising a frame.

2. (Dependent on 1) The method of claim 1, further comprising a connector."""

        claims = parse_claims(raw)
        assert len(claims) == 3
        # Should be renumbered 1, 2, 3
        assert claims[0].claim_number == 1
        assert claims[1].claim_number == 2
        assert claims[2].claim_number == 3
        # Dependent's parent ref should point to renumbered claim 1 (not 2)
        assert claims[2].parent_claim_number == 1
        assert claims[2].claim_type == "DEPENDENT"

    def test_duplicate_numbering_preserves_unique_sequence(self):
        """When no duplicates, numbering is left as-is."""
        raw = """1. (Independent - Broad - Method) A method.

2. (Dependent on 1) The method of claim 1, with a step.

3. (Independent - Medium - System) A system."""

        claims = parse_claims(raw)
        assert claims[0].claim_number == 1
        assert claims[1].claim_number == 2
        assert claims[2].claim_number == 3
        assert claims[1].parent_claim_number == 1


class TestParseClaimsRevisionNotes:
    def test_truncates_claims_with_appended_revision_notes(self):
        """Revision notes after --- and ## CLAIM SUMMARY must not leak into claims."""
        raw = """1. (Independent - Broad - Method) A method comprising: step a; and step b.

2. (Dependent on 1) The method of claim 1, wherein step a uses a processor.

3. (Independent - Medium - System) A system comprising: a processor and a memory.

---

## CLAIM SUMMARY

This set contains 3 claims covering method and system aspects.

## KEY REVISIONS

Revised claim 2 for clarity."""

        claims = parse_claims(raw)
        assert len(claims) == 3
        for c in claims:
            assert "CLAIM SUMMARY" not in c.text
            assert "KEY REVISIONS" not in c.text
            assert "Revised claim" not in c.text

    def test_truncates_claim_text_exceeding_max_length(self):
        """Claims longer than 5000 chars are truncated with a marker."""
        long_body = "A method comprising: " + ("x " * 3500)  # well over 5000 chars
        raw = f"1. (Independent - Broad - Method) {long_body}"
        claims = parse_claims(raw)
        assert len(claims) == 1
        assert len(claims[0].text) <= 5000 + len(" [...text truncated]")
        assert claims[0].text.endswith("[...text truncated]")

    def test_normal_claims_under_5000_chars_not_truncated(self):
        """Claims under the limit pass through unchanged."""
        raw = "1. (Independent - Broad - Method) A method comprising: receiving input and processing it."
        claims = parse_claims(raw)
        assert len(claims) == 1
        assert "[...text truncated]" not in claims[0].text
        assert claims[0].text.startswith("A method")
