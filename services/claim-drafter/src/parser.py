"""
Claim text parser — extracts structured Claim objects from raw AI-generated text.

Handles the standard claim format:
  1. (Independent - Broad - Method) A method comprising: ...
  2. (Dependent on 1) The method of claim 1, wherein ...
"""

from __future__ import annotations
import re

from .models import Claim


def parse_claims(raw_text: str) -> list[Claim]:
    """
    Parse raw claim text into structured Claim objects.
    Handles numbered claims with optional metadata annotations.
    """
    claims: list[Claim] = []

    # Split on claim numbers at line start: "1." or "1. " or "Claim 1."
    # Captures the number and everything until the next claim or end
    claim_pattern = re.compile(
        r'(?:^|\n)\s*(?:Claim\s+)?(\d+)\.\s*(.*?)(?=\n\s*(?:Claim\s+)?\d+\.\s|\Z)',
        re.DOTALL,
    )

    for match in claim_pattern.finditer(raw_text):
        num = int(match.group(1))
        body = match.group(2).strip()

        # Extract metadata from parenthetical annotations
        # e.g., "(Independent - Broad - Method)" or "(Dependent on 1)"
        claim_type = "INDEPENDENT"
        scope_level = None
        statutory_type = None
        parent_num = None

        meta_match = re.match(r'\(([^)]+)\)\s*', body)
        if meta_match:
            meta = meta_match.group(1).lower()
            body = body[meta_match.end():].strip()

            if "independent" in meta:
                claim_type = "INDEPENDENT"
            elif "dependent" in meta:
                claim_type = "DEPENDENT"
                parent_ref = re.search(r'(?:on|of)\s+(?:claim\s+)?(\d+)', meta)
                if parent_ref:
                    parent_num = int(parent_ref.group(1))

            if "broad" in meta:
                scope_level = "BROAD"
            elif "medium" in meta:
                scope_level = "MEDIUM"
            elif "narrow" in meta:
                scope_level = "NARROW"

            if "method" in meta:
                statutory_type = "method"
            elif "system" in meta:
                statutory_type = "system"
            elif "apparatus" in meta:
                statutory_type = "apparatus"
            elif "crm" in meta or "computer" in meta or "medium" in meta:
                statutory_type = "crm"

        # Infer dependent claims from "The method/system of claim N" pattern
        # Only if metadata didn't already classify this claim
        if claim_type == "INDEPENDENT" and not meta_match:
            dep_match = re.match(
                r'The\s+(?:method|system|apparatus|medium|device|composition)\s+of\s+claim\s+(\d+)',
                body,
                re.IGNORECASE,
            )
            if dep_match:
                claim_type = "DEPENDENT"
                parent_num = int(dep_match.group(1))

        # Clean up the text
        text = re.sub(r'\s+', ' ', body).strip()

        if text:
            claims.append(Claim(
                claim_number=num,
                claim_type=claim_type,
                scope_level=scope_level if claim_type == "INDEPENDENT" else None,
                statutory_type=statutory_type,
                parent_claim_number=parent_num,
                text=text,
            ))

    return claims
