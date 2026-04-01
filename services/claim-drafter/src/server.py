"""
PatentForge Claim Drafter — FastAPI server.

Endpoints:
  GET  /health          — Service health check with prompt hashes
  POST /draft           — Run the claim drafting pipeline (SSE stream)
"""

from __future__ import annotations
import json
import hashlib
import os
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from sse_starlette.sse import EventSourceResponse

from .models import ClaimDraftRequest, ClaimDraftResult
from .graph import run_claim_pipeline

app = FastAPI(title="PatentForge Claim Drafter", version="0.4.0")

# Internal service auth — only the NestJS backend should call this service.
# Set INTERNAL_SERVICE_SECRET env var to enable. When not set, auth is disabled (dev mode).
INTERNAL_SECRET = os.environ.get("INTERNAL_SERVICE_SECRET", "")

# API key: prefer environment variable over request body.
# This prevents the key from flowing through HTTP request bodies.
ANTHROPIC_API_KEY_ENV = os.environ.get("ANTHROPIC_API_KEY", "")


def resolve_api_key(request_key: str) -> str:
    """Use env var if set, otherwise fall back to request body value."""
    return ANTHROPIC_API_KEY_ENV or request_key

api_key_header = APIKeyHeader(name="X-Internal-Secret", auto_error=False)


async def verify_internal_secret(key: str | None = Depends(api_key_header)):
    """Reject requests without valid internal secret (when secret is configured)."""
    if not INTERNAL_SECRET:
        return  # Auth disabled in dev mode
    if key != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Invalid or missing internal service secret")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
        "service": "patentforge-claim-drafter",
        "promptHashes": _compute_prompt_hashes(),
    }


# ── Claim drafting endpoint ──────────────────────────────────────────────────

@app.post("/draft", dependencies=[Depends(verify_internal_secret)])
async def draft_claims(request: ClaimDraftRequest):
    """
    Run the claim drafting pipeline. Returns SSE stream with progress events.
    Final event contains the complete ClaimDraftResult.
    """
    # Build prior art context string
    prior_art_parts = []
    for pa in request.prior_art_results:
        part = f"**{pa.patent_number}** — {pa.title}"
        if pa.abstract:
            part += f"\nAbstract: {pa.abstract[:400]}"
        if pa.claims_text:
            part += f"\nClaims:\n{pa.claims_text[:2000]}"
        prior_art_parts.append(part)
    prior_art_context = "\n\n".join(prior_art_parts) if prior_art_parts else "(No prior art results available)"
    # Cap total context size to prevent oversized prompts
    if len(prior_art_context) > 50_000:
        prior_art_context = prior_art_context[:50_000] + "\n\n(truncated — prior art context exceeds 50K characters)"

    async def event_stream():
        steps_seen = []

        def on_step(node_name: str, step: str):
            steps_seen.append(node_name)

        try:
            result = await run_claim_pipeline(
                invention_narrative=request.invention_narrative,
                feasibility_stage_5=request.feasibility_stage_5,
                feasibility_stage_6=request.feasibility_stage_6,
                prior_art_context=prior_art_context,
                api_key=resolve_api_key(request.settings.api_key),
                default_model=request.settings.default_model,
                research_model=request.settings.research_model,
                max_tokens=request.settings.max_tokens,
                on_step=on_step,
            )

            # Emit step events for each completed step
            for step in steps_seen:
                yield {"event": "step", "data": json.dumps({"step": step})}

            # Emit final result
            yield {
                "event": "complete",
                "data": result.model_dump_json(),
            }
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)}),
            }

    return EventSourceResponse(event_stream())


# ── Synchronous draft endpoint (for simpler integration) ─────────────────────

@app.post("/draft/sync", response_model=ClaimDraftResult, dependencies=[Depends(verify_internal_secret)])
async def draft_claims_sync(request: ClaimDraftRequest):
    """
    Run the claim drafting pipeline synchronously. Returns the complete result.
    Use /draft for SSE streaming in production.
    """
    prior_art_parts = []
    for pa in request.prior_art_results:
        part = f"**{pa.patent_number}** — {pa.title}"
        if pa.abstract:
            part += f"\nAbstract: {pa.abstract[:400]}"
        if pa.claims_text:
            part += f"\nClaims:\n{pa.claims_text[:2000]}"
        prior_art_parts.append(part)
    prior_art_context = "\n\n".join(prior_art_parts) if prior_art_parts else "(No prior art results available)"
    # Cap total context size to prevent oversized prompts
    if len(prior_art_context) > 50_000:
        prior_art_context = prior_art_context[:50_000] + "\n\n(truncated — prior art context exceeds 50K characters)"

    return await run_claim_pipeline(
        invention_narrative=request.invention_narrative,
        feasibility_stage_5=request.feasibility_stage_5,
        feasibility_stage_6=request.feasibility_stage_6,
        prior_art_context=prior_art_context,
        api_key=resolve_api_key(request.settings.api_key),
        default_model=request.settings.default_model,
        research_model=request.settings.research_model,
        max_tokens=request.settings.max_tokens,
    )


if __name__ == "__main__":
    import uvicorn
    # Bind to localhost only in local mode. Docker overrides via Dockerfile CMD.
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "3002"))
    uvicorn.run(app, host=host, port=port)
