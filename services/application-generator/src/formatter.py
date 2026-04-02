"""
USPTO formatting: paragraph numbering and IDS table generation.
"""

from __future__ import annotations
from .models import PriorArtItem


def apply_paragraph_numbering(text: str, start: int = 1) -> tuple[str, int]:
    """
    Apply USPTO paragraph numbering [NNNN] to each paragraph.

    Args:
        text: Section text with paragraphs separated by blank lines.
        start: Starting paragraph number.

    Returns:
        (numbered_text, next_paragraph_number)
    """
    if not text or not text.strip():
        return "", start

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    numbered = []
    num = start
    for para in paragraphs:
        numbered.append(f"[{num:04d}] {para}")
        num += 1
    return "\n\n".join(numbered), num


def format_ids_table(items: list[PriorArtItem]) -> str:
    """
    Format prior art results as an Information Disclosure Statement table.

    Returns empty string if no items.
    """
    if not items:
        return ""

    lines = []
    lines.append("| Ref | Patent/Publication Number | Title |")
    lines.append("|-----|--------------------------|-------|")
    for i, item in enumerate(items, 1):
        title = item.title[:120] + "..." if len(item.title) > 120 else item.title
        lines.append(f"| {i} | {item.patent_number} | {title} |")
    return "\n".join(lines)
