"""
PatentForge Compliance Checker — FastAPI server.

Endpoints:
  GET  /health    — Service health check with prompt hashes
  POST /check     — Run the compliance checking pipeline (sync)
"""

from __future__ import annotations
import json
import hashlib
import os
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader

from .models import ComplianceRequest, ComplianceResponse
from .graph import run_compliance_pipeline

app = FastAPI(title="PatentForge Compliance Checker", version="0.5.0")

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
        "service": "patentforge-compliance-checker",
        "promptHashes": _compute_prompt_hashes(),
    }


@app.post("/check", response_model=ComplianceResponse, dependencies=[Depends(verify_internal_secret)])
async def check_compliance(request: ComplianceRequest):
    """Run the compliance checking pipeline synchronously. Returns the complete result."""
    claims_parts = []
    for c in request.claims:
        if c.claim_type == "INDEPENDENT":
            prefix = f"Claim {c.claim_number} (Independent):"
        else:
            prefix = f"Claim {c.claim_number} (Dependent on Claim {c.parent_claim_number}):"
        claims_parts.append(f"{prefix}\n{c.text}")
    claims_text = "\n\n".join(claims_parts)

    return await run_compliance_pipeline(
        claims_text=claims_text,
        specification_text=request.specification_text,
        invention_narrative=request.invention_narrative,
        prior_art_context=request.prior_art_context,
        api_key=resolve_api_key(request.settings.api_key),
        default_model=request.settings.default_model,
        max_tokens=request.settings.max_tokens,
    )


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "3004"))
    uvicorn.run(app, host=host, port=port)
