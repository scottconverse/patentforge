# v0.6 Application Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a patent application generator that assembles upstream artifacts into a USPTO-formatted patent application with Word and Markdown export.

**Architecture:** New Python microservice (FastAPI + LangGraph) with 5 sequential LLM agents, integrated via existing NestJS fire-and-forget pattern, with a new React tab component matching the ComplianceTab pattern.

**Tech Stack:** Python 3.12, FastAPI, LangGraph, Anthropic SDK, python-docx, sse-starlette, NestJS, React/TypeScript/Tailwind

**Spec:** `docs/superpowers/specs/2026-04-02-v06-application-generator-design.md`

---

## File Map

### New Files (Python Service)
- `services/application-generator/pyproject.toml` — package config + deps
- `services/application-generator/Dockerfile` — python:3.12-slim container
- `services/application-generator/src/__init__.py` — empty
- `services/application-generator/src/server.py` — FastAPI app, endpoints, auth
- `services/application-generator/src/models.py` — Pydantic request/response/state
- `services/application-generator/src/cost.py` — token cost estimation
- `services/application-generator/src/graph.py` — LangGraph pipeline
- `services/application-generator/src/formatter.py` — USPTO paragraph numbering + IDS
- `services/application-generator/src/exporter.py` — DOCX + Markdown export
- `services/application-generator/src/agents/__init__.py` — empty
- `services/application-generator/src/agents/background.py` — background section agent
- `services/application-generator/src/agents/summary.py` — summary section agent
- `services/application-generator/src/agents/detailed_description.py` — detailed description agent
- `services/application-generator/src/agents/abstract.py` — abstract agent
- `services/application-generator/src/agents/figures.py` — figure descriptions agent
- `services/application-generator/src/prompts/common-rules.md` — shared rules
- `services/application-generator/src/prompts/background.md` — background prompt
- `services/application-generator/src/prompts/summary.md` — summary prompt
- `services/application-generator/src/prompts/detailed-description.md` — detailed description prompt
- `services/application-generator/src/prompts/abstract.md` — abstract prompt
- `services/application-generator/src/prompts/figures.md` — figures prompt
- `services/application-generator/tests/__init__.py` — empty
- `services/application-generator/tests/test_auth.py` — auth tests
- `services/application-generator/tests/test_models.py` — validation tests
- `services/application-generator/tests/test_formatter.py` — formatting tests
- `services/application-generator/tests/test_graph.py` — pipeline tests
- `services/application-generator/tests/test_exporter.py` — export tests

### New Files (Backend)
- `backend/src/application/application.module.ts` — NestJS module
- `backend/src/application/application.controller.ts` — REST endpoints
- `backend/src/application/application.service.ts` — business logic
- `backend/src/application/dto/update-section.dto.ts` — validation DTO
- `backend/src/application/application.spec.ts` — unit tests

### New Files (Frontend)
- `frontend/src/components/ApplicationTab.tsx` — main component
- `frontend/src/components/ApplicationTab.test.tsx` — component tests

### Modified Files
- `backend/prisma/schema.prisma` — add 5 columns to PatentApplication
- `backend/src/app.module.ts` — register ApplicationModule
- `frontend/src/api.ts` — add application API methods
- `frontend/src/components/ProjectDetail.tsx` — add Application tab
- `docker-compose.yml` — add application-generator service
- `PatentForge.ps1` — add 6th service startup
- `PatentForge.bat` — add 6th service startup

---

## Task 1: Python Service Scaffold

**Files:**
- Create: `services/application-generator/pyproject.toml`
- Create: `services/application-generator/Dockerfile`
- Create: `services/application-generator/src/__init__.py`
- Create: `services/application-generator/src/cost.py`
- Create: `services/application-generator/src/models.py`
- Create: `services/application-generator/src/server.py`
- Test: `services/application-generator/tests/__init__.py`
- Test: `services/application-generator/tests/test_auth.py`
- Test: `services/application-generator/tests/test_models.py`

- [ ] **Step 1: Create pyproject.toml**

```toml
[project]
name = "patentforge-application-generator"
version = "0.6.0"
description = "Patent application generation service for PatentForge"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0,<1.0",
    "uvicorn[standard]>=0.34.0,<1.0",
    "langgraph>=0.3.0,<1.0",
    "anthropic>=0.42.0,<1.0",
    "pydantic>=2.0,<3.0",
    "sse-starlette>=2.0,<3.0",
    "python-docx>=1.1.0,<2.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.25.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
```

- [ ] **Step 2: Create Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY src/ src/

EXPOSE 3003

CMD ["uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "3003"]
```

- [ ] **Step 3: Create src/__init__.py and tests/__init__.py**

Both empty files.

- [ ] **Step 4: Create src/cost.py**

Copy exact pattern from `services/claim-drafter/src/cost.py`:

```python
"""
Cost estimation for Claude API calls.
Uses approximate per-token pricing for Anthropic models.
"""

MODEL_PRICING = {
    "claude-haiku-4-5-20251001": {"input": 0.80, "output": 4.00},
    "claude-sonnet-4-20250514": {"input": 3.00, "output": 15.00},
    "claude-opus-4-20250514": {"input": 15.00, "output": 75.00},
}

DEFAULT_PRICING = {"input": 3.00, "output": 15.00}


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate USD cost for an API call based on model and token counts."""
    pricing = MODEL_PRICING.get(model, DEFAULT_PRICING)
    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    return round(input_cost + output_cost, 6)
```

- [ ] **Step 5: Create src/models.py**

```python
"""
Pydantic models for the application generator service.
"""

from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field, field_validator


class PriorArtItem(BaseModel):
    patent_number: str
    title: str
    abstract: str | None = None
    relevance_score: float = 0.0
    claims_text: str | None = None


class GenerateSettings(BaseModel):
    api_key: str = ""
    default_model: str
    research_model: str = ""
    max_tokens: int = 32000


class ApplicationGenerateRequest(BaseModel):
    invention_narrative: str = Field(max_length=100_000)
    feasibility_stage_1: str = Field(default="", max_length=200_000)
    feasibility_stage_5: str = Field(default="", max_length=200_000)
    feasibility_stage_6: str = Field(default="", max_length=200_000)
    prior_art_results: list[PriorArtItem] = Field(default_factory=list)
    claims_text: str = Field(default="", max_length=200_000)
    spec_language: str = Field(default="", max_length=200_000)
    settings: GenerateSettings

    @field_validator("prior_art_results")
    @classmethod
    def cap_prior_art(cls, v: list[PriorArtItem]) -> list[PriorArtItem]:
        if len(v) > 20:
            raise ValueError("Maximum 20 prior art results allowed")
        return v


class ApplicationGenerateResult(BaseModel):
    title: str = ""
    cross_references: str = ""
    background: str = ""
    summary: str = ""
    detailed_description: str = ""
    claims: str = ""
    abstract: str = ""
    figure_descriptions: str = ""
    ids_table: str = ""
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_estimated_cost_usd: float = 0.0
    status: Literal["SUCCESS", "ERROR"] = "SUCCESS"
    error_message: str | None = None


class ExportRequest(BaseModel):
    title: str = ""
    cross_references: str = ""
    background: str = ""
    summary: str = ""
    detailed_description: str = ""
    claims: str = ""
    abstract: str = ""
    figure_descriptions: str = ""
    ids_table: str = ""


class GraphState(BaseModel):
    invention_narrative: str = ""
    feasibility_stage_1: str = ""
    feasibility_stage_5: str = ""
    feasibility_stage_6: str = ""
    prior_art_context: str = ""
    claims_text: str = ""
    spec_language: str = ""
    api_key: str = ""
    default_model: str = ""
    research_model: str = ""
    max_tokens: int = 32000

    background: str = ""
    summary: str = ""
    detailed_description: str = ""
    abstract: str = ""
    figure_descriptions: str = ""

    cross_references: str = ""
    ids_table: str = ""

    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_estimated_cost_usd: float = 0.0

    step: str = ""
    error: str | None = None
```

- [ ] **Step 6: Create src/server.py**

Follow the exact claim-drafter server.py pattern. Endpoints: GET /health, POST /generate (SSE), POST /generate/sync, POST /export/docx, POST /export/markdown.

```python
"""
PatentForge Application Generator — FastAPI server.

Endpoints:
  GET  /health           — Health check with prompt hashes
  POST /generate         — Run application generation (SSE stream)
  POST /generate/sync    — Run application generation (blocking)
  POST /export/docx      — Export to Word
  POST /export/markdown  — Export to Markdown
"""

from __future__ import annotations
import json
import hashlib
import os
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from fastapi.responses import Response
from sse_starlette.sse import EventSourceResponse

from .models import ApplicationGenerateRequest, ApplicationGenerateResult, ExportRequest
from .graph import run_application_pipeline
from .exporter import export_docx, export_markdown

app = FastAPI(title="PatentForge Application Generator", version="0.6.0")

INTERNAL_SECRET = os.environ.get("INTERNAL_SERVICE_SECRET", "")
ANTHROPIC_API_KEY_ENV = os.environ.get("ANTHROPIC_API_KEY", "")


def resolve_api_key(request_key: str) -> str:
    return ANTHROPIC_API_KEY_ENV or request_key


api_key_header = APIKeyHeader(name="X-Internal-Secret", auto_error=False)


async def verify_internal_secret(key: str | None = Depends(api_key_header)):
    if not INTERNAL_SECRET:
        return
    if key != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Invalid or missing internal service secret")


_allowed_origins = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

PROMPTS_DIR = Path(__file__).parent / "prompts"


def _compute_prompt_hashes() -> dict[str, str]:
    hashes = {}
    if PROMPTS_DIR.exists():
        for f in sorted(PROMPTS_DIR.glob("*.md")):
            content = f.read_text(encoding="utf-8")
            h = hashlib.sha256(content.encode()).hexdigest()[:16]
            hashes[f.name] = h
    return hashes


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "patentforge-application-generator",
        "version": "0.6.0",
        "promptHashes": _compute_prompt_hashes(),
    }


def _build_prior_art_context(request: ApplicationGenerateRequest) -> str:
    parts = []
    for pa in request.prior_art_results:
        part = f"**{pa.patent_number}** — {pa.title}"
        if pa.abstract:
            part += f"\nAbstract: {pa.abstract[:400]}"
        if pa.claims_text:
            part += f"\nClaims:\n{pa.claims_text[:2000]}"
        parts.append(part)
    ctx = "\n\n".join(parts) if parts else "(No prior art results available)"
    if len(ctx) > 50_000:
        ctx = ctx[:50_000] + "\n\n(truncated)"
    return ctx


@app.post("/generate", dependencies=[Depends(verify_internal_secret)])
async def generate_application(request: ApplicationGenerateRequest):
    prior_art_context = _build_prior_art_context(request)

    async def event_stream():
        steps_seen = []

        def on_step(node_name: str, step: str):
            steps_seen.append(node_name)

        try:
            result = await run_application_pipeline(
                invention_narrative=request.invention_narrative,
                feasibility_stage_1=request.feasibility_stage_1,
                feasibility_stage_5=request.feasibility_stage_5,
                feasibility_stage_6=request.feasibility_stage_6,
                prior_art_context=prior_art_context,
                prior_art_results=request.prior_art_results,
                claims_text=request.claims_text,
                spec_language=request.spec_language,
                api_key=resolve_api_key(request.settings.api_key),
                default_model=request.settings.default_model,
                research_model=request.settings.research_model,
                max_tokens=request.settings.max_tokens,
                on_step=on_step,
            )

            for step in steps_seen:
                yield {"event": "step", "data": json.dumps({"step": step, "status": "complete"})}

            yield {"event": "complete", "data": result.model_dump_json()}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"message": str(e)})}

    return EventSourceResponse(event_stream())


@app.post("/generate/sync", response_model=ApplicationGenerateResult, dependencies=[Depends(verify_internal_secret)])
async def generate_application_sync(request: ApplicationGenerateRequest):
    prior_art_context = _build_prior_art_context(request)
    return await run_application_pipeline(
        invention_narrative=request.invention_narrative,
        feasibility_stage_1=request.feasibility_stage_1,
        feasibility_stage_5=request.feasibility_stage_5,
        feasibility_stage_6=request.feasibility_stage_6,
        prior_art_context=prior_art_context,
        prior_art_results=request.prior_art_results,
        claims_text=request.claims_text,
        spec_language=request.spec_language,
        api_key=resolve_api_key(request.settings.api_key),
        default_model=request.settings.default_model,
        research_model=request.settings.research_model,
        max_tokens=request.settings.max_tokens,
    )


@app.post("/export/docx", dependencies=[Depends(verify_internal_secret)])
async def export_to_docx(request: ExportRequest):
    docx_bytes = export_docx(request)
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="patent-application.docx"'},
    )


@app.post("/export/markdown", dependencies=[Depends(verify_internal_secret)])
async def export_to_markdown(request: ExportRequest):
    md = export_markdown(request)
    return Response(content=md, media_type="text/markdown")


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "3003"))
    uvicorn.run(app, host=host, port=port)
```

- [ ] **Step 7: Write test_auth.py**

```python
"""Tests for internal service authentication."""

import pytest
from fastapi.testclient import TestClient


class TestInternalAuth:
    def test_health_always_accessible(self):
        from src.server import app
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["service"] == "patentforge-application-generator"

    def test_generate_accessible_when_no_secret(self):
        from src.server import app
        client = TestClient(app)
        resp = client.post("/generate/sync", json={
            "invention_narrative": "test",
            "claims_text": "1. A method.",
            "settings": {"api_key": "fake", "default_model": "claude-haiku-4-5-20251001"},
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "ERROR"

    def test_generate_rejected_without_secret(self):
        import src.server as srv
        original = srv.INTERNAL_SECRET
        srv.INTERNAL_SECRET = "test-secret-123"
        try:
            client = TestClient(srv.app)
            resp = client.post("/generate/sync", json={
                "invention_narrative": "test",
                "claims_text": "1. A method.",
                "settings": {"api_key": "fake", "default_model": "claude-haiku-4-5-20251001"},
            })
            assert resp.status_code == 403
        finally:
            srv.INTERNAL_SECRET = original

    def test_generate_accepted_with_correct_secret(self):
        import src.server as srv
        original = srv.INTERNAL_SECRET
        srv.INTERNAL_SECRET = "test-secret-123"
        try:
            client = TestClient(srv.app)
            resp = client.post(
                "/generate/sync",
                json={
                    "invention_narrative": "test",
                    "claims_text": "1. A method.",
                    "settings": {"api_key": "fake", "default_model": "claude-haiku-4-5-20251001"},
                },
                headers={"X-Internal-Secret": "test-secret-123"},
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "ERROR"
        finally:
            srv.INTERNAL_SECRET = original

    def test_generate_rejected_with_wrong_secret(self):
        import src.server as srv
        original = srv.INTERNAL_SECRET
        srv.INTERNAL_SECRET = "correct"
        try:
            client = TestClient(srv.app)
            resp = client.post(
                "/generate/sync",
                json={
                    "invention_narrative": "test",
                    "claims_text": "1. A method.",
                    "settings": {"api_key": "fake", "default_model": "claude-haiku-4-5-20251001"},
                },
                headers={"X-Internal-Secret": "wrong"},
            )
            assert resp.status_code == 403
        finally:
            srv.INTERNAL_SECRET = original
```

- [ ] **Step 8: Write test_models.py**

```python
"""Tests for request/response model validation."""

import pytest
from pydantic import ValidationError
from src.models import ApplicationGenerateRequest, GenerateSettings, PriorArtItem


class TestRequestValidation:
    def test_valid_request(self):
        req = ApplicationGenerateRequest(
            invention_narrative="A novel widget",
            claims_text="1. A method of making widgets.",
            settings=GenerateSettings(default_model="claude-sonnet-4-20250514"),
        )
        assert req.invention_narrative == "A novel widget"

    def test_missing_model_rejected(self):
        with pytest.raises(ValidationError):
            ApplicationGenerateRequest(
                invention_narrative="test",
                settings=GenerateSettings(),  # type: ignore — default_model is required
            )

    def test_too_many_prior_art_rejected(self):
        items = [PriorArtItem(patent_number=f"US{i}", title=f"Patent {i}") for i in range(21)]
        with pytest.raises(ValidationError, match="Maximum 20"):
            ApplicationGenerateRequest(
                invention_narrative="test",
                prior_art_results=items,
                settings=GenerateSettings(default_model="claude-sonnet-4-20250514"),
            )

    def test_twenty_prior_art_accepted(self):
        items = [PriorArtItem(patent_number=f"US{i}", title=f"Patent {i}") for i in range(20)]
        req = ApplicationGenerateRequest(
            invention_narrative="test",
            prior_art_results=items,
            settings=GenerateSettings(default_model="claude-sonnet-4-20250514"),
        )
        assert len(req.prior_art_results) == 20
```

- [ ] **Step 9: Install deps and run tests**

Run:
```bash
cd services/application-generator && pip install -e ".[dev]"
```

Then:
```bash
cd services/application-generator && python -m pytest tests/test_auth.py tests/test_models.py -v
```

Expected: test_auth tests will fail (graph.py doesn't exist yet — server can't fully start for sync endpoint). test_models tests should pass. This is expected — we build the graph next.

- [ ] **Step 10: Commit**

```bash
git add services/application-generator/
git commit -m "feat(app-gen): scaffold Python service with models, server, auth tests"
```

---

## Task 2: Formatter — USPTO Paragraph Numbering + IDS

**Files:**
- Create: `services/application-generator/src/formatter.py`
- Test: `services/application-generator/tests/test_formatter.py`

- [ ] **Step 1: Write test_formatter.py**

```python
"""Tests for USPTO paragraph numbering and IDS table formatting."""

from src.formatter import apply_paragraph_numbering, format_ids_table
from src.models import PriorArtItem


class TestParagraphNumbering:
    def test_single_section(self):
        text = "First paragraph.\n\nSecond paragraph."
        result, next_num = apply_paragraph_numbering(text, start=1)
        assert result == "[0001] First paragraph.\n\n[0002] Second paragraph."
        assert next_num == 3

    def test_continuity_across_sections(self):
        bg = "Background paragraph."
        summary = "Summary paragraph."
        bg_result, next_num = apply_paragraph_numbering(bg, start=1)
        summary_result, next_num2 = apply_paragraph_numbering(summary, start=next_num)
        assert bg_result == "[0001] Background paragraph."
        assert summary_result == "[0002] Summary paragraph."
        assert next_num2 == 3

    def test_empty_section(self):
        result, next_num = apply_paragraph_numbering("", start=1)
        assert result == ""
        assert next_num == 1

    def test_single_paragraph(self):
        result, next_num = apply_paragraph_numbering("One paragraph only.", start=5)
        assert result == "[0005] One paragraph only."
        assert next_num == 6

    def test_strips_existing_whitespace(self):
        text = "  Padded paragraph.  \n\n  Another.  "
        result, next_num = apply_paragraph_numbering(text, start=1)
        assert "[0001] Padded paragraph." in result
        assert "[0002] Another." in result


class TestIdsTable:
    def test_formats_prior_art_items(self):
        items = [
            PriorArtItem(patent_number="US10123456", title="Widget System", abstract="A widget"),
            PriorArtItem(patent_number="US20200012345", title="Gadget Method", abstract="A gadget"),
        ]
        table = format_ids_table(items)
        assert "US10123456" in table
        assert "Widget System" in table
        assert "US20200012345" in table
        assert "Gadget Method" in table
        assert "Ref" in table  # header row

    def test_empty_list(self):
        table = format_ids_table([])
        assert table == ""

    def test_truncates_long_titles(self):
        items = [PriorArtItem(patent_number="US1", title="A" * 200)]
        table = format_ids_table(items)
        assert len(table) > 0
        # Title should be present but may be truncated
        assert "US1" in table
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/application-generator && python -m pytest tests/test_formatter.py -v
```

Expected: ImportError — `src.formatter` does not exist yet.

- [ ] **Step 3: Create src/formatter.py**

```python
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
```

- [ ] **Step 4: Run tests**

```bash
cd services/application-generator && python -m pytest tests/test_formatter.py -v
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add services/application-generator/src/formatter.py services/application-generator/tests/test_formatter.py
git commit -m "feat(app-gen): USPTO paragraph numbering and IDS table formatter"
```

---

## Task 3: Prompts

**Files:**
- Create: `services/application-generator/src/prompts/common-rules.md`
- Create: `services/application-generator/src/prompts/background.md`
- Create: `services/application-generator/src/prompts/summary.md`
- Create: `services/application-generator/src/prompts/detailed-description.md`
- Create: `services/application-generator/src/prompts/abstract.md`
- Create: `services/application-generator/src/prompts/figures.md`

- [ ] **Step 1: Create common-rules.md**

```markdown
# PatentForge — Application Generation Rules

You are a patent application drafting assistant. You generate sections of a USPTO patent application based on invention disclosures, feasibility analyses, prior art research, and drafted claims.

## Critical Rules

1. **You are NOT a patent attorney.** Your output is a research draft that must be reviewed by a registered patent attorney or agent before filing.
2. **Do not invent technical details.** Only describe what the inventor has disclosed. If information is missing, note what additional disclosure is needed rather than fabricating details.
3. **Use formal patent language.** Write in the passive voice, present tense ("is configured to", "comprises", "includes"). Avoid colloquial language.
4. **Reference claims precisely.** When discussing claim elements, use the exact terminology from the claims.
5. **Do not repeat content.** If prior sections have been provided, do not duplicate their content. Reference them and add new information.
6. **Each paragraph should be a complete thought.** Paragraphs will receive [NNNN] numbering — keep them focused and self-contained.

## Formatting

- Use plain text paragraphs separated by blank lines.
- Do NOT include paragraph numbers — those are added automatically.
- Do NOT include section headers — those are added by the assembly system.
- Do NOT use markdown formatting (no #, **, -, etc.).
```

- [ ] **Step 2: Create background.md**

```markdown
# Background of the Invention

Generate the "Background of the Invention" section for a USPTO patent application.

## Structure

1. **Field of the Invention** (1-2 paragraphs): State the technical field the invention relates to. Be specific but not so narrow as to limit the scope.

2. **Description of Related Art** (3-6 paragraphs): Describe the current state of the art and existing solutions. Identify the specific technical problems or limitations of existing approaches. Use the prior art context provided to reference known patents and publications. Do not characterize prior art as "deficient" — instead, neutrally describe what it does and does not do.

3. **Need for the Invention** (1-2 paragraphs): Bridge from the problems identified to the need for a new solution. Do not describe the invention itself — that comes in the Summary.

## Input Context

You will receive:
- The inventor's narrative describing their invention
- A technical restatement from feasibility analysis (Stage 1)
- Prior art references with titles and abstracts

## Output

Write the Background section as plain text paragraphs. Each paragraph should be a complete, focused thought suitable for [NNNN] numbering.
```

- [ ] **Step 3: Create summary.md**

```markdown
# Summary of the Invention

Generate the "Summary of the Invention" section for a USPTO patent application.

## Structure

1. **Brief Summary** (2-3 paragraphs): Describe what the invention is and what problem it solves. Mirror the broadest independent claim without copying it verbatim.

2. **Key Aspects** (2-4 paragraphs): Describe the principal features and advantages of the invention. Each aspect should correspond to one or more independent claims.

3. **Advantages** (1-2 paragraphs): State the technical advantages over the prior art described in the Background section. Be factual — avoid superlatives.

## Input Context

You will receive:
- The inventor's narrative
- The Background section (already written — do not repeat its content)
- The drafted claims

## Output

Write the Summary section as plain text paragraphs. Reference claim elements by their exact terminology.
```

- [ ] **Step 4: Create detailed-description.md**

```markdown
# Detailed Description of Preferred Embodiments

Generate the "Detailed Description" section for a USPTO patent application. This is the longest and most technically detailed section.

## Structure

1. **Overview** (2-3 paragraphs): High-level description of the preferred embodiment, referencing the figures described elsewhere.

2. **Component Description** (5-15 paragraphs): Describe each component, module, or step of the invention in detail. For each element mentioned in the claims, provide sufficient detail that a person of ordinary skill in the art could make and use the invention (35 USC 112(a) enablement requirement).

3. **Operation** (3-8 paragraphs): Describe how the components work together. Walk through the operation step by step.

4. **Alternative Embodiments** (2-4 paragraphs): Describe alternative implementations or variations. This broadens the scope of disclosure beyond the specific claims.

5. **Integration** (1-2 paragraphs): Describe how the invention integrates with existing systems or standards, if applicable.

## Input Context

You will receive:
- The inventor's narrative
- The Background and Summary sections (already written — do not repeat)
- IP strategy and recommendations from feasibility analysis
- Specification language from claim drafting
- The drafted claims

## Output

Write the Detailed Description as plain text paragraphs. Every claim element must be described. Use consistent terminology with the claims.
```

- [ ] **Step 5: Create abstract.md**

```markdown
# Abstract of the Disclosure

Generate the "Abstract" section for a USPTO patent application.

## Rules

- EXACTLY ONE paragraph, no line breaks
- Between 50 and 150 words (USPTO requirement)
- Must describe the technical disclosure in concise terms
- Should correspond to the broadest independent claim
- Begin with a phrase indicating the field of the invention
- Do NOT include legal phraseology ("said", "comprising", "wherein")
- Do NOT reference specific patent numbers, figures, or claim numbers
- Do NOT include marketing language or value judgments

## Input Context

You will receive:
- The Background, Summary, and Detailed Description sections (already written)
- The drafted claims

## Output

Write exactly one paragraph of 50-150 words.
```

- [ ] **Step 6: Create figures.md**

```markdown
# Brief Description of the Drawings

Generate the "Brief Description of the Drawings" section for a USPTO patent application.

## Rules

- Generate placeholder figure descriptions based on the invention's architecture and operation
- Each figure entry should be one paragraph: "FIG. N is a [type of diagram] showing [what it depicts]."
- Common figure types: block diagram, flowchart, schematic view, perspective view, cross-sectional view, system architecture diagram
- Generate 3-8 figures that would adequately illustrate the invention
- Reference components described in the Detailed Description
- These are PLACEHOLDERS — the inventor will create the actual drawings

## Input Context

You will receive:
- The Detailed Description section (already written)
- The drafted claims

## Output

Write one paragraph per figure. Each paragraph starts with "FIG. N" where N is the figure number.
```

- [ ] **Step 7: Commit**

```bash
git add services/application-generator/src/prompts/
git commit -m "feat(app-gen): add LLM prompts for all 5 application sections"
```

---

## Task 4: Agents

**Files:**
- Create: `services/application-generator/src/agents/__init__.py`
- Create: `services/application-generator/src/agents/background.py`
- Create: `services/application-generator/src/agents/summary.py`
- Create: `services/application-generator/src/agents/detailed_description.py`
- Create: `services/application-generator/src/agents/abstract.py`
- Create: `services/application-generator/src/agents/figures.py`

- [ ] **Step 1: Create agents/__init__.py**

Empty file.

- [ ] **Step 2: Create agents/background.py**

```python
"""Background agent — generates Background of the Invention section."""

from __future__ import annotations
from pathlib import Path

import anthropic

from ..models import GraphState
from ..cost import estimate_cost

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt() -> str:
    common = ""
    common_path = PROMPTS_DIR / "common-rules.md"
    if common_path.exists():
        common = common_path.read_text(encoding="utf-8") + "\n\n"
    prompt_path = PROMPTS_DIR / "background.md"
    if prompt_path.exists():
        return common + prompt_path.read_text(encoding="utf-8")
    return common + "Generate the Background of the Invention section."


async def run_background(state: GraphState) -> GraphState:
    prompt = _load_prompt()
    model = state.default_model

    user_message = f"""## Invention Narrative

{state.invention_narrative}

## Technical Restatement (Feasibility Stage 1)

{state.feasibility_stage_1}

## Prior Art Context

{state.prior_art_context}

---

Generate the Background of the Invention section."""

    client = anthropic.AsyncAnthropic(api_key=state.api_key)
    try:
        response = await client.messages.create(
            model=model,
            max_tokens=state.max_tokens,
            system=prompt,
            messages=[{"role": "user", "content": user_message}],
            timeout=300.0,
        )
        text = response.content[0].text
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        state.total_input_tokens += input_tokens
        state.total_output_tokens += output_tokens
        state.total_estimated_cost_usd += estimate_cost(model, input_tokens, output_tokens)
    except Exception as e:
        state.error = f"Background agent failed: {e}"
        return state

    state.background = text
    state.step = "background"
    return state
```

- [ ] **Step 3: Create agents/summary.py**

```python
"""Summary agent — generates Summary of the Invention section."""

from __future__ import annotations
from pathlib import Path

import anthropic

from ..models import GraphState
from ..cost import estimate_cost

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt() -> str:
    common = ""
    common_path = PROMPTS_DIR / "common-rules.md"
    if common_path.exists():
        common = common_path.read_text(encoding="utf-8") + "\n\n"
    prompt_path = PROMPTS_DIR / "summary.md"
    if prompt_path.exists():
        return common + prompt_path.read_text(encoding="utf-8")
    return common + "Generate the Summary of the Invention section."


async def run_summary(state: GraphState) -> GraphState:
    prompt = _load_prompt()
    model = state.default_model

    user_message = f"""## Invention Narrative

{state.invention_narrative}

## Claims

{state.claims_text}

## Previously Written Sections (do not repeat this content)

### Background of the Invention
{state.background}

---

Generate the Summary of the Invention section."""

    client = anthropic.AsyncAnthropic(api_key=state.api_key)
    try:
        response = await client.messages.create(
            model=model,
            max_tokens=state.max_tokens,
            system=prompt,
            messages=[{"role": "user", "content": user_message}],
            timeout=300.0,
        )
        text = response.content[0].text
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        state.total_input_tokens += input_tokens
        state.total_output_tokens += output_tokens
        state.total_estimated_cost_usd += estimate_cost(model, input_tokens, output_tokens)
    except Exception as e:
        state.error = f"Summary agent failed: {e}"
        return state

    state.summary = text
    state.step = "summary"
    return state
```

- [ ] **Step 4: Create agents/detailed_description.py**

```python
"""Detailed Description agent — generates Detailed Description of Preferred Embodiments."""

from __future__ import annotations
from pathlib import Path

import anthropic

from ..models import GraphState
from ..cost import estimate_cost

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt() -> str:
    common = ""
    common_path = PROMPTS_DIR / "common-rules.md"
    if common_path.exists():
        common = common_path.read_text(encoding="utf-8") + "\n\n"
    prompt_path = PROMPTS_DIR / "detailed-description.md"
    if prompt_path.exists():
        return common + prompt_path.read_text(encoding="utf-8")
    return common + "Generate the Detailed Description section."


async def run_detailed_description(state: GraphState) -> GraphState:
    prompt = _load_prompt()
    model = state.default_model

    user_message = f"""## Invention Narrative

{state.invention_narrative}

## Claims

{state.claims_text}

## IP Strategy & Recommendations (Feasibility Stage 5)

{state.feasibility_stage_5}

## Consolidated Report (Feasibility Stage 6)

{state.feasibility_stage_6}

## Specification Language (from Claim Drafter)

{state.spec_language}

## Previously Written Sections (do not repeat this content)

### Background of the Invention
{state.background}

### Summary of the Invention
{state.summary}

---

Generate the Detailed Description of Preferred Embodiments section."""

    client = anthropic.AsyncAnthropic(api_key=state.api_key)
    try:
        response = await client.messages.create(
            model=model,
            max_tokens=state.max_tokens,
            system=prompt,
            messages=[{"role": "user", "content": user_message}],
            timeout=300.0,
        )
        text = response.content[0].text
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        state.total_input_tokens += input_tokens
        state.total_output_tokens += output_tokens
        state.total_estimated_cost_usd += estimate_cost(model, input_tokens, output_tokens)
    except Exception as e:
        state.error = f"Detailed description agent failed: {e}"
        return state

    state.detailed_description = text
    state.step = "detailed_description"
    return state
```

- [ ] **Step 5: Create agents/abstract.py**

```python
"""Abstract agent — generates Abstract of the Disclosure (150 words max)."""

from __future__ import annotations
from pathlib import Path

import anthropic

from ..models import GraphState
from ..cost import estimate_cost

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt() -> str:
    common = ""
    common_path = PROMPTS_DIR / "common-rules.md"
    if common_path.exists():
        common = common_path.read_text(encoding="utf-8") + "\n\n"
    prompt_path = PROMPTS_DIR / "abstract.md"
    if prompt_path.exists():
        return common + prompt_path.read_text(encoding="utf-8")
    return common + "Generate the Abstract of the Disclosure."


async def run_abstract(state: GraphState) -> GraphState:
    prompt = _load_prompt()
    model = state.default_model

    user_message = f"""## Claims

{state.claims_text}

## Previously Written Sections (do not repeat — summarize)

### Background of the Invention
{state.background}

### Summary of the Invention
{state.summary}

### Detailed Description
{state.detailed_description}

---

Generate the Abstract of the Disclosure. Exactly one paragraph, 50-150 words."""

    client = anthropic.AsyncAnthropic(api_key=state.api_key)
    try:
        response = await client.messages.create(
            model=model,
            max_tokens=2000,  # abstract is short — limit output
            system=prompt,
            messages=[{"role": "user", "content": user_message}],
            timeout=300.0,
        )
        text = response.content[0].text
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        state.total_input_tokens += input_tokens
        state.total_output_tokens += output_tokens
        state.total_estimated_cost_usd += estimate_cost(model, input_tokens, output_tokens)
    except Exception as e:
        state.error = f"Abstract agent failed: {e}"
        return state

    state.abstract = text
    state.step = "abstract"
    return state
```

- [ ] **Step 6: Create agents/figures.py**

```python
"""Figures agent — generates Brief Description of the Drawings."""

from __future__ import annotations
from pathlib import Path

import anthropic

from ..models import GraphState
from ..cost import estimate_cost

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt() -> str:
    common = ""
    common_path = PROMPTS_DIR / "common-rules.md"
    if common_path.exists():
        common = common_path.read_text(encoding="utf-8") + "\n\n"
    prompt_path = PROMPTS_DIR / "figures.md"
    if prompt_path.exists():
        return common + prompt_path.read_text(encoding="utf-8")
    return common + "Generate the Brief Description of the Drawings."


async def run_figures(state: GraphState) -> GraphState:
    prompt = _load_prompt()
    model = state.default_model

    user_message = f"""## Claims

{state.claims_text}

## Detailed Description

{state.detailed_description}

---

Generate the Brief Description of the Drawings. Create 3-8 placeholder figure descriptions."""

    client = anthropic.AsyncAnthropic(api_key=state.api_key)
    try:
        response = await client.messages.create(
            model=model,
            max_tokens=4000,  # figures section is short
            system=prompt,
            messages=[{"role": "user", "content": user_message}],
            timeout=300.0,
        )
        text = response.content[0].text
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        state.total_input_tokens += input_tokens
        state.total_output_tokens += output_tokens
        state.total_estimated_cost_usd += estimate_cost(model, input_tokens, output_tokens)
    except Exception as e:
        state.error = f"Figures agent failed: {e}"
        return state

    state.figure_descriptions = text
    state.step = "figures"
    return state
```

- [ ] **Step 7: Commit**

```bash
git add services/application-generator/src/agents/
git commit -m "feat(app-gen): add 5 LLM agents (background, summary, detailed_desc, abstract, figures)"
```

---

## Task 5: LangGraph Pipeline + Exporter

**Files:**
- Create: `services/application-generator/src/graph.py`
- Create: `services/application-generator/src/exporter.py`
- Test: `services/application-generator/tests/test_graph.py`
- Test: `services/application-generator/tests/test_exporter.py`

- [ ] **Step 1: Write test_graph.py**

```python
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
        """All edges should be simple (no conditional routing)."""
        graph = build_graph()
        # Build and compile succeeds = edges are valid
        compiled = graph.compile()
        assert compiled is not None
```

- [ ] **Step 2: Write test_exporter.py**

```python
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
        # DOCX magic bytes (PK zip)
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
        assert "# Background" in result
        assert "# Claims" in result

    def test_includes_ids_table(self):
        result = export_markdown(_sample_request())
        assert "Information Disclosure Statement" in result
        assert "US10123456" in result

    def test_empty_sections_omitted(self):
        req = ExportRequest(title="Minimal", claims="1. A method.")
        result = export_markdown(req)
        assert "# Claims" in result
        assert "# Background" not in result  # empty background omitted
```

- [ ] **Step 3: Create src/graph.py**

```python
"""
LangGraph pipeline for patent application generation.

Flow: background → summary → detailed_description → abstract → figures → format_ids → finalize
"""

from __future__ import annotations
from typing import Callable

from langgraph.graph import StateGraph, END

from .models import GraphState, ApplicationGenerateResult, PriorArtItem
from .agents.background import run_background
from .agents.summary import run_summary
from .agents.detailed_description import run_detailed_description
from .agents.abstract import run_abstract
from .agents.figures import run_figures
from .formatter import format_ids_table


async def format_ids(state: GraphState) -> GraphState:
    """Format prior art into IDS table. No LLM call."""
    # prior_art_context is a string — we need the structured items for IDS.
    # They're passed via the pipeline runner, not stored in GraphState directly.
    # IDS is formatted before the pipeline runs and injected. See run_application_pipeline.
    state.step = "format_ids"
    return state


async def finalize(state: GraphState) -> GraphState:
    """Scrub API key from state."""
    state.api_key = ""
    state.step = "finalize"
    return state


def build_graph() -> StateGraph:
    graph = StateGraph(GraphState)

    graph.add_node("background", run_background)
    graph.add_node("summary", run_summary)
    graph.add_node("detailed_description", run_detailed_description)
    graph.add_node("abstract", run_abstract)
    graph.add_node("figures", run_figures)
    graph.add_node("format_ids", format_ids)
    graph.add_node("finalize", finalize)

    graph.set_entry_point("background")
    graph.add_edge("background", "summary")
    graph.add_edge("summary", "detailed_description")
    graph.add_edge("detailed_description", "abstract")
    graph.add_edge("abstract", "figures")
    graph.add_edge("figures", "format_ids")
    graph.add_edge("format_ids", "finalize")
    graph.add_edge("finalize", END)

    return graph


application_pipeline = build_graph().compile()


async def run_application_pipeline(
    invention_narrative: str,
    feasibility_stage_1: str,
    feasibility_stage_5: str,
    feasibility_stage_6: str,
    prior_art_context: str,
    prior_art_results: list[PriorArtItem],
    claims_text: str,
    spec_language: str,
    api_key: str,
    default_model: str = "claude-sonnet-4-20250514",
    research_model: str = "",
    max_tokens: int = 32000,
    on_step: Callable[[str, str], None] | None = None,
) -> ApplicationGenerateResult:
    """Run the full application generation pipeline."""

    # Format IDS table from structured prior art before pipeline starts
    ids_table = format_ids_table(prior_art_results)

    initial_state = GraphState(
        invention_narrative=invention_narrative,
        feasibility_stage_1=feasibility_stage_1,
        feasibility_stage_5=feasibility_stage_5,
        feasibility_stage_6=feasibility_stage_6,
        prior_art_context=prior_art_context,
        claims_text=claims_text,
        spec_language=spec_language,
        api_key=api_key,
        default_model=default_model,
        research_model=research_model,
        max_tokens=max_tokens,
        ids_table=ids_table,
    )

    state_dict: dict = initial_state.model_dump()
    async for step_output in application_pipeline.astream(state_dict):
        for node_name, node_state in step_output.items():
            if isinstance(node_state, dict):
                state_dict = node_state
            else:
                state_dict = node_state.model_dump() if hasattr(node_state, "model_dump") else dict(node_state)
            if on_step:
                on_step(node_name, state_dict.get("step", ""))
            if state_dict.get("error"):
                return ApplicationGenerateResult(
                    status="ERROR",
                    error_message=state_dict["error"],
                    background=state_dict.get("background", ""),
                    summary=state_dict.get("summary", ""),
                    detailed_description=state_dict.get("detailed_description", ""),
                    abstract=state_dict.get("abstract", ""),
                    figure_descriptions=state_dict.get("figure_descriptions", ""),
                    ids_table=state_dict.get("ids_table", ""),
                    total_input_tokens=state_dict.get("total_input_tokens", 0),
                    total_output_tokens=state_dict.get("total_output_tokens", 0),
                    total_estimated_cost_usd=state_dict.get("total_estimated_cost_usd", 0.0),
                )

    return ApplicationGenerateResult(
        title=state_dict.get("invention_narrative", "").split("\n")[0][:200],  # first line as title
        cross_references=state_dict.get("cross_references", ""),
        background=state_dict.get("background", ""),
        summary=state_dict.get("summary", ""),
        detailed_description=state_dict.get("detailed_description", ""),
        claims=state_dict.get("claims_text", ""),
        abstract=state_dict.get("abstract", ""),
        figure_descriptions=state_dict.get("figure_descriptions", ""),
        ids_table=state_dict.get("ids_table", ""),
        total_input_tokens=state_dict.get("total_input_tokens", 0),
        total_output_tokens=state_dict.get("total_output_tokens", 0),
        total_estimated_cost_usd=state_dict.get("total_estimated_cost_usd", 0.0),
        status="SUCCESS",
    )
```

- [ ] **Step 4: Create src/exporter.py**

```python
"""
Export patent application to DOCX and Markdown formats.
"""

from __future__ import annotations
import io
from datetime import datetime

from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

from .models import ExportRequest


def export_docx(req: ExportRequest) -> bytes:
    """Generate a Word document from the application sections."""
    doc = Document()

    # Title page
    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title_para.add_run(req.title or "Patent Application")
    run.bold = True
    run.font.size = Pt(18)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = subtitle.add_run("Patent Application")
    sub_run.font.size = Pt(14)

    date_para = doc.add_paragraph()
    date_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    date_para.add_run(f"Generated: {datetime.now().strftime('%Y-%m-%d')}")

    # Disclaimer
    disclaimer = doc.add_paragraph()
    disclaimer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    d_run = disclaimer.add_run(
        "\nIMPORTANT: This is an AI-generated research draft. "
        "It must be reviewed by a registered patent attorney before filing."
    )
    d_run.italic = True
    d_run.font.size = Pt(9)

    doc.add_page_break()

    # Sections
    sections = [
        ("Cross-Reference to Related Applications", req.cross_references),
        ("Background of the Invention", req.background),
        ("Summary of the Invention", req.summary),
        ("Detailed Description of Preferred Embodiments", req.detailed_description),
        ("Claims", req.claims),
        ("Abstract of the Disclosure", req.abstract),
        ("Brief Description of the Drawings", req.figure_descriptions),
        ("Information Disclosure Statement", req.ids_table),
    ]

    for heading, content in sections:
        if not content or not content.strip():
            continue
        doc.add_heading(heading, level=1)
        for para_text in content.split("\n\n"):
            para_text = para_text.strip()
            if not para_text:
                continue
            # Handle markdown table rows in IDS
            if para_text.startswith("|"):
                doc.add_paragraph(para_text, style="Normal")
            else:
                doc.add_paragraph(para_text)

    # Footer disclaimer
    doc.add_paragraph()
    footer = doc.add_paragraph()
    f_run = footer.add_run("Generated by PatentForge — Not Legal Advice")
    f_run.italic = True
    f_run.font.size = Pt(8)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def export_markdown(req: ExportRequest) -> str:
    """Generate a Markdown document from the application sections."""
    parts = []

    parts.append(f"# {req.title or 'Patent Application'}\n")
    parts.append(f"*Generated: {datetime.now().strftime('%Y-%m-%d')}*\n")
    parts.append("*AI-generated research draft — must be reviewed by a registered patent attorney.*\n")

    sections = [
        ("Cross-Reference to Related Applications", req.cross_references),
        ("Background of the Invention", req.background),
        ("Summary of the Invention", req.summary),
        ("Detailed Description of Preferred Embodiments", req.detailed_description),
        ("Claims", req.claims),
        ("Abstract of the Disclosure", req.abstract),
        ("Brief Description of the Drawings", req.figure_descriptions),
        ("Information Disclosure Statement", req.ids_table),
    ]

    for heading, content in sections:
        if not content or not content.strip():
            continue
        parts.append(f"\n## {heading}\n")
        parts.append(content.strip())
        parts.append("")

    return "\n".join(parts)
```

- [ ] **Step 5: Run all Python tests**

```bash
cd services/application-generator && python -m pytest tests/ -v
```

Expected: All tests pass (auth, models, formatter, graph, exporter).

- [ ] **Step 6: Verify health endpoint starts**

```bash
cd services/application-generator && python -c "from src.server import app; print('OK')"
```

Expected: `OK` — all imports resolve.

- [ ] **Step 7: Commit**

```bash
git add services/application-generator/src/graph.py services/application-generator/src/exporter.py services/application-generator/tests/test_graph.py services/application-generator/tests/test_exporter.py
git commit -m "feat(app-gen): LangGraph pipeline, DOCX/Markdown export, all tests passing"
```

---

## Task 6: Prisma Schema Update

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add 5 columns to PatentApplication model**

In `backend/prisma/schema.prisma`, find the `PatentApplication` model and add the new fields:

```prisma
model PatentApplication {
  id                  String    @id @default(uuid())
  projectId           String
  project             Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  version             Int
  status              String    @default("PENDING")
  title               String?
  abstract            String?
  background          String?
  summary             String?
  detailedDescription String?
  claims              String?
  figureDescriptions  String?
  crossReferences     String?
  idsTable            String?
  estimatedCostUsd    Float?
  completedAt         DateTime?
  errorMessage        String?
  createdAt           DateTime  @default(now())
}
```

- [ ] **Step 2: Push schema to dev database**

```bash
cd backend && npx prisma db push
```

Expected: Schema synced to SQLite dev database.

- [ ] **Step 3: Verify Prisma client generation**

```bash
cd backend && npx prisma generate
```

Expected: Client generated successfully.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(schema): add crossReferences, idsTable, cost, completedAt, errorMessage to PatentApplication"
```

---

## Task 7: Backend Module

**Files:**
- Create: `backend/src/application/application.module.ts`
- Create: `backend/src/application/application.controller.ts`
- Create: `backend/src/application/application.service.ts`
- Create: `backend/src/application/dto/update-section.dto.ts`
- Create: `backend/src/application/application.spec.ts`
- Modify: `backend/src/app.module.ts`

This task contains substantial NestJS code following the exact claim-draft patterns. The implementing engineer should:

- [ ] **Step 1: Create dto/update-section.dto.ts**

```typescript
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateSectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500000)
  text: string;
}
```

- [ ] **Step 2: Create application.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { ApplicationController } from './application.controller';
import { ApplicationService } from './application.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [ApplicationController],
  providers: [ApplicationService],
})
export class ApplicationModule {}
```

- [ ] **Step 3: Create application.service.ts**

Follow the claim-draft.service.ts pattern exactly: `onModuleInit()` cleanup, `startGeneration()` with fire-and-forget, `callApplicationGenerator()` with `http.request` and 900s timeout, `updateSection()`, `getLatest()`, `getByVersion()`, `getDocxBuffer()`, `getMarkdown()`.

Key differences from claim-draft:
- URL env var: `APPLICATION_GENERATOR_URL` (default `http://localhost:3003`)
- Endpoint: `/generate/sync`
- Response fields: title, crossReferences, background, summary, detailedDescription, claims, abstract, figureDescriptions, idsTable, estimatedCostUsd
- Section validation: title, crossReferences, background, summary, detailedDescription, claims, figureDescriptions, abstract, idsTable
- Collects: invention narrative, feasibility stages 1/5/6, prior art results with cached claims, claims text, spec language
- Export endpoints proxy to Python service POST /export/docx and POST /export/markdown

- [ ] **Step 4: Create application.controller.ts**

```typescript
import { Controller, Get, Post, Put, Param, Body, ParseIntPipe, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApplicationService } from './application.service';
import { UpdateSectionDto } from './dto/update-section.dto';

@Controller('projects/:id/application')
export class ApplicationController {
  constructor(private readonly service: ApplicationService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  startGeneration(@Param('id') projectId: string) {
    return this.service.startGeneration(projectId);
  }

  @Get()
  getLatest(@Param('id') projectId: string) {
    return this.service.getLatest(projectId);
  }

  @Get('export/docx')
  async exportToDocx(@Param('id') projectId: string, @Res() res: Response) {
    const { buffer, filename } = await this.service.getDocxBuffer(projectId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('export/markdown')
  async exportToMarkdown(@Param('id') projectId: string, @Res() res: Response) {
    const { text, filename } = await this.service.getMarkdown(projectId);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(text);
  }

  @Get(':version')
  getByVersion(
    @Param('id') projectId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.service.getByVersion(projectId, version);
  }

  @Put('sections/:name')
  @HttpCode(HttpStatus.OK)
  updateSection(
    @Param('id') projectId: string,
    @Param('name') sectionName: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.service.updateSection(projectId, sectionName, dto.text);
  }
}
```

- [ ] **Step 5: Register ApplicationModule in app.module.ts**

Add import and registration:

```typescript
import { ApplicationModule } from './application/application.module';

@Module({
  imports: [PrismaModule, ProjectsModule, FeasibilityModule, SettingsModule, PriorArtModule, PatentDetailModule, ClaimDraftModule, ComplianceModule, ApplicationModule],
})
export class AppModule {}
```

- [ ] **Step 6: Write application.spec.ts**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationService } from './application.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

describe('ApplicationService', () => {
  // Minimal tests — validates service instantiation and key validation logic.
  // Full integration tested via E2E.

  it('should reject startGeneration when no claims exist', async () => {
    // Mock PrismaService to return project with no completed claims
    // Expect BadRequestException
  });

  it('should reject updateSection with invalid section name', async () => {
    // Call updateSection with sectionName="invalid"
    // Expect BadRequestException
  });
});
```

The implementing engineer should flesh out these tests with proper mocking following the claim-draft.spec.ts pattern.

- [ ] **Step 7: Verify backend compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/application/ backend/src/app.module.ts
git commit -m "feat(backend): application module with controller, service, DTO, tests"
```

---

## Task 8: Frontend — API Layer + ApplicationTab + Wiring

**Files:**
- Modify: `frontend/src/api.ts`
- Create: `frontend/src/components/ApplicationTab.tsx`
- Create: `frontend/src/components/ApplicationTab.test.tsx`
- Modify: `frontend/src/components/ProjectDetail.tsx`

- [ ] **Step 1: Add application methods to api.ts**

Add after the `compliance` section:

```typescript
application: {
  start: (projectId: string) =>
    req<any>('POST', `/projects/${projectId}/application/generate`),
  getLatest: (projectId: string) =>
    req<any>('GET', `/projects/${projectId}/application`),
  getVersion: (projectId: string, version: number) =>
    req<any>('GET', `/projects/${projectId}/application/${version}`),
  updateSection: (projectId: string, name: string, text: string) =>
    req<any>('PUT', `/projects/${projectId}/application/sections/${name}`, { text }),
  exportDocx: async (projectId: string): Promise<Blob> => {
    const res = await fetch(`${BASE}/projects/${projectId}/application/export/docx`);
    if (!res.ok) {
      const text = await res.text();
      let message = text;
      try { const json = JSON.parse(text); message = json.message || json.error || text; } catch {}
      throw new Error(message);
    }
    return res.blob();
  },
  exportMarkdown: (projectId: string) =>
    req<string>('GET', `/projects/${projectId}/application/export/markdown`),
},
```

- [ ] **Step 2: Create ApplicationTab.tsx**

Follow ComplianceTab.tsx pattern exactly. States: loading, no-claims gate, generate button with UPL modal, running/polling, complete with section navigation + inline editing + export. Full implementation — see spec Section 5 for all details.

- [ ] **Step 3: Write ApplicationTab.test.tsx**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ApplicationTab from './ApplicationTab';

vi.mock('../api', () => ({
  api: {
    application: {
      start: vi.fn(),
      getLatest: vi.fn(),
      updateSection: vi.fn(),
    },
  },
}));

describe('ApplicationTab', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows no-claims message when hasClaims is false', async () => {
    const { api } = await import('../api');
    (api.application.getLatest as any).mockResolvedValue({ status: 'NONE' });
    render(<ApplicationTab projectId="test" hasClaims={false} />);
    await waitFor(() => {
      expect(screen.getByText(/Draft claims before generating/i)).toBeTruthy();
    });
  });

  it('shows generate button when no application exists', async () => {
    const { api } = await import('../api');
    (api.application.getLatest as any).mockResolvedValue({ status: 'NONE' });
    render(<ApplicationTab projectId="test" hasClaims={true} />);
    await waitFor(() => {
      expect(screen.getByText('Generate Application')).toBeTruthy();
    });
  });

  it('shows UPL modal on generate click', async () => {
    const { api } = await import('../api');
    (api.application.getLatest as any).mockResolvedValue({ status: 'NONE' });
    render(<ApplicationTab projectId="test" hasClaims={true} />);
    await waitFor(() => {
      expect(screen.getByText('Generate Application')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Generate Application'));
    await waitFor(() => {
      expect(screen.getByText(/research tool, not a legal service/i)).toBeTruthy();
    });
  });

  it('shows spinner when generating', async () => {
    const { api } = await import('../api');
    (api.application.getLatest as any).mockResolvedValue({ status: 'RUNNING' });
    render(<ApplicationTab projectId="test" hasClaims={true} />);
    await waitFor(() => {
      expect(screen.getByText(/Generating patent application/i)).toBeTruthy();
    });
  });

  it('shows sections when complete', async () => {
    const { api } = await import('../api');
    (api.application.getLatest as any).mockResolvedValue({
      status: 'COMPLETE',
      background: 'The field of widgets...',
      summary: 'A widget system...',
      claims: '1. A method.',
    });
    render(<ApplicationTab projectId="test" hasClaims={true} />);
    await waitFor(() => {
      expect(screen.getByText(/Background/i)).toBeTruthy();
    });
  });
});
```

- [ ] **Step 4: Wire ApplicationTab into ProjectDetail.tsx**

Three changes:
1. Import: `import ApplicationTab from './ApplicationTab';`
2. Add `'application'` to the ViewMode type union
3. Add "Application" button in sidebar after Compliance (enabled when claims exist)
4. Add render block: `{viewMode === 'application' && <ApplicationTab projectId={id} hasClaims={hasCompletedClaims} />}`

- [ ] **Step 5: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Run frontend tests**

```bash
cd frontend && npx vitest run
```

Expected: All tests pass including new ApplicationTab tests.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api.ts frontend/src/components/ApplicationTab.tsx frontend/src/components/ApplicationTab.test.tsx frontend/src/components/ProjectDetail.tsx
git commit -m "feat(frontend): ApplicationTab with section nav, inline editing, export, UPL modal"
```

---

## Task 9: Docker Compose + Launcher Scripts

**Files:**
- Modify: `docker-compose.yml`
- Modify: `PatentForge.ps1`
- Modify: `PatentForge.bat`

- [ ] **Step 1: Add application-generator to docker-compose.yml**

Add after the `compliance-checker` service:

```yaml
  application-generator:
    build: ./services/application-generator
    environment:
      PORT: 3003
      HOST: "0.0.0.0"
      INTERNAL_SERVICE_SECRET: ${INTERNAL_SERVICE_SECRET:?Set INTERNAL_SERVICE_SECRET — run: export INTERNAL_SERVICE_SECRET=$$(openssl rand -hex 32)}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
    restart: unless-stopped
```

Add to backend environment:

```yaml
      APPLICATION_GENERATOR_URL: http://application-generator:3003
```

- [ ] **Step 2: Update PatentForge.ps1**

Add application-generator startup alongside other Python services. Follow the existing claim-drafter/compliance-checker pattern.

- [ ] **Step 3: Update PatentForge.bat**

Same — add application-generator startup.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml PatentForge.ps1 PatentForge.bat
git commit -m "feat(infra): add application-generator to Docker Compose and launcher scripts"
```

---

## Task 10: Version Bump + Integration Test

**Files:**
- Modify: `backend/package.json` (version → 0.6.0)
- Modify: `frontend/package.json` (version → 0.6.0)
- Modify: `services/claim-drafter/pyproject.toml` (version → 0.6.0)
- Modify: `services/compliance-checker/pyproject.toml` (version → 0.6.0)

- [ ] **Step 1: Bump all versions to 0.6.0**

Update version in all 5 package files (including application-generator which was already created as 0.6.0).

- [ ] **Step 2: Run full backend test suite**

```bash
cd backend && npx jest --verbose
```

Expected: All existing tests pass + new application tests pass.

- [ ] **Step 3: Run full Python test suites**

```bash
cd services/application-generator && python -m pytest tests/ -v
cd services/claim-drafter && python -m pytest tests/ -v
cd services/compliance-checker && python -m pytest tests/ -v
```

Expected: All pass. No regressions in existing services.

- [ ] **Step 4: Run full frontend test suite**

```bash
cd frontend && npx vitest run
```

Expected: All pass including new ApplicationTab tests.

- [ ] **Step 5: Verify all services start**

```bash
cd services/application-generator && python -c "from src.server import app; print('app-gen OK')"
cd backend && npx tsc --noEmit && echo "backend OK"
cd frontend && npx tsc --noEmit && echo "frontend OK"
```

- [ ] **Step 6: Commit version bump**

```bash
git add backend/package.json frontend/package.json services/claim-drafter/pyproject.toml services/compliance-checker/pyproject.toml
git commit -m "chore: bump version to 0.6.0 across all services"
```

- [ ] **Step 7: Report to user for review**

Present the complete change summary, test results, and all commits for review before any push.
