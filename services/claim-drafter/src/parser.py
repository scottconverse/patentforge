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

    # Try two formats:
    # Format A: "### CLAIM 1 (metadata)\n\nClaim text..."  (markdown heading)
    # Format B: "1. (metadata) Claim text..."  (numbered list)
    heading_pattern = re.compile(
        r'#{1,4}\s*CLAIM\s+(\d+)\s*\(([^)]+)\)\s*\n+(.*?)(?=\n#{1,4}\s*CLAIM\s+\d+|\n---|\n##\s|\Z)',
        re.DOTALL | re.IGNORECASE,
    )

    heading_matches = list(heading_pattern.finditer(raw_text))
    if heading_matches:
        # Format A: heading-based claims
        for match in heading_matches:
            num = int(match.group(1))
            meta_raw = match.group(2)
            body = match.group(3).strip()
            # Merge meta into body for unified processing below
            body = f"({meta_raw}) {body}"
    else:
        # Format B: numbered claims — use original regex
        pass

    # Unified pattern for both formats
    if heading_matches:
        entries = [(int(m.group(1)), f"({m.group(2)}) {m.group(3).strip()}") for m in heading_matches]
    else:
        numbered_pattern = re.compile(
            r'(?:^|\n)\s*(?:Claim\s+)?(\d+)\.\s*(.*?)(?=\n\s*(?:Claim\s+)?\d+\.\s|\Z)',
            re.DOTALL,
        )
        entries = [(int(m.group(1)), m.group(2).strip()) for m in numbered_pattern.finditer(raw_text)]

    for num, body in entries:

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

    # Fix duplicate numbering (e.g. Haiku outputting multiple "Claim 1" entries).
    # Renumber all claims sequentially 1..N, then fix parent references.
    has_dupes = len({c.claim_number for c in claims}) < len(claims)
    if has_dupes:
        old_to_new: dict[int, int] = {}
        for idx, c in enumerate(claims):
            new_num = idx + 1
            # Track first occurrence mapping (parent refs point to original numbers)
            if c.claim_number not in old_to_new:
                old_to_new[c.claim_number] = new_num
            c.claim_number = new_num

        # Update parent references using the mapping
        for c in claims:
            if c.parent_claim_number is not None and c.parent_claim_number in old_to_new:
                c.parent_claim_number = old_to_new[c.parent_claim_number]

    return claims
