"""
PatentForge Application Generator — FastAPI server.

Endpoints:
  GET  /health          — Service health check with prompt hashes
  POST /generate        — Run the application generation pipeline (SSE stream)
  POST /generate/sync   — Run the pipeline synchronously
  POST /export/docx     — Export application as Word document
  POST /export/pdf      — Export application as PDF
  POST /export/markdown — Export application as Markdown
"""

from __future__ import annotations
import json
import hashlib
import os
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.security import APIKeyHeader
from sse_starlette.sse import EventSourceResponse

from .models import GenerateRequest, ApplicationResult
from .graph import run_application_pipeline

app = FastAPI(title="PatentForge Application Generator", version="0.6.0")

INTERNAL_SECRET = os.environ.get("INTERNAL_SERVICE_SECRET", "")
ANTHROPIC_API_KEY_ENV = os.environ.get("ANTHROPIC_API_KEY", "")


def resolve_api_key(request_key: str) -> str:
    """Use env var if set, otherwise fall back to request body value."""
    return ANTHROPIC_API_KEY_ENV or request_key


api_key_header = APIKeyHeader(name="X-Internal-Secret", auto_error=False)


async def verify_internal_secret(key: str | None = Depends(api_key_header)):
    """Reject requests without valid internal secret (when secret is configured)."""
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

# ── Prompt integrity hashes ───────────────────────────────────────────────────

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
        "promptHashes": _compute_prompt_hashes(),
    }


# ── Helper: build prior art context string ────────────────────────────────────

def _build_prior_art_context(request: GenerateRequest) -> str:
    parts = []
    for pa in request.prior_art_results:
        part = f"**{pa.patent_number}** — {pa.title}"
        if pa.abstract:
            part += f"\nAbstract: {pa.abstract[:400]}"
        parts.append(part)
    context = "\n\n".join(parts) if parts else "(No prior art results available)"
    if len(context) > 50_000:
        context = context[:50_000] + "\n\n(truncated — prior art context exceeds 50K characters)"
    return context


# ── Generate endpoints ────────────────────────────────────────────────────────

@app.post("/generate", dependencies=[Depends(verify_internal_secret)])
async def generate_application(request: GenerateRequest):
    """Run the application generation pipeline. Returns SSE stream with progress events."""
    prior_art_context = _build_prior_art_context(request)

    async def event_stream():
        steps_seen = []

        def on_step(node_name: str, step: str):
            steps_seen.append(node_name)

        try:
            result = await run_application_pipeline(
                invention_title=request.invention_title,
                invention_narrative=request.invention_narrative,
                feasibility_stage_1=request.feasibility_stage_1,
                feasibility_stage_5=request.feasibility_stage_5,
                feasibility_stage_6=request.feasibility_stage_6,
                claims=[c.model_dump() for c in request.claims],
                specification_language=request.specification_language,
                prior_art_context=prior_art_context,
                compliance_passed=request.compliance_passed,
                api_key=resolve_api_key(request.settings.api_key),
                default_model=request.settings.default_model,
                max_tokens=request.settings.max_tokens,
                on_step=on_step,
            )

            for step in steps_seen:
                yield {"event": "step", "data": json.dumps({"step": step})}

            yield {"event": "complete", "data": result.model_dump_json()}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"error": str(e)})}

    return EventSourceResponse(event_stream())


@app.post("/generate/sync", response_model=ApplicationResult, dependencies=[Depends(verify_internal_secret)])
async def generate_application_sync(request: GenerateRequest):
    """Run the pipeline synchronously. Returns the complete result."""
    prior_art_context = _build_prior_art_context(request)

    return await run_application_pipeline(
        invention_title=request.invention_title,
        invention_narrative=request.invention_narrative,
        feasibility_stage_1=request.feasibility_stage_1,
        feasibility_stage_5=request.feasibility_stage_5,
        feasibility_stage_6=request.feasibility_stage_6,
        claims=[c.model_dump() for c in request.claims],
        specification_language=request.specification_language,
        prior_art_context=prior_art_context,
        compliance_passed=request.compliance_passed,
        api_key=resolve_api_key(request.settings.api_key),
        default_model=request.settings.default_model,
        max_tokens=request.settings.max_tokens,
    )


# ── Export endpoints ──────────────────────────────────────────────────────────

@app.post("/export/docx", dependencies=[Depends(verify_internal_secret)])
async def export_docx(result: ApplicationResult):
    """Export a completed application as Word (.docx)."""
    from .exporter import export_docx as _export_docx
    doc_bytes = _export_docx(result)
    return Response(
        content=doc_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=patent-application.docx"},
    )


@app.post("/export/pdf", dependencies=[Depends(verify_internal_secret)])
async def export_pdf(result: ApplicationResult):
    """Export a completed application as PDF."""
    from .exporter import export_pdf as _export_pdf
    pdf_bytes = _export_pdf(result)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=patent-application.pdf"},
    )


@app.post("/export/markdown", dependencies=[Depends(verify_internal_secret)])
async def export_markdown(result: ApplicationResult):
    """Export a completed application as Markdown."""
    from .exporter import export_markdown as _export_md
    md_text = _export_md(result)
    return Response(
        content=md_text,
        media_type="text/markdown",
        headers={"Content-Disposition": "attachment; filename=patent-application.md"},
    )


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "3003"))
    uvicorn.run(app, host=host, port=port)
