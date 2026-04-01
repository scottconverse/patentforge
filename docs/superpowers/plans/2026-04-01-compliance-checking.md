# PatentForge v0.5 — Compliance Checking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automated compliance checking that validates drafted patent claims against 35 USC 112(a), 112(b), MPEP 608, and 35 USC 101 using LLM-native analysis, plus individual claim regeneration and prior art overlap warnings.

**Architecture:** New Python + FastAPI compliance-checker service (port 3004) mirrors the claim-drafter pattern. Four checker agents run sequentially via LangGraph, each evaluating claims against a specific legal rule. Results are persisted via the existing Prisma `ComplianceCheck`/`ComplianceResult` tables. A new NestJS `compliance` backend module orchestrates the flow. The frontend gets a new `ComplianceTab` component with traffic-light results.

**Tech Stack:** Python 3.11+, FastAPI, LangGraph, Anthropic SDK, Pydantic v2 (compliance-checker service); NestJS, Prisma (backend module); React 18, TypeScript, Tailwind CSS (frontend)

---

## File Structure

### New Files — Compliance Checker Service (`services/compliance-checker/`)

| File | Responsibility |
|------|---------------|
| `pyproject.toml` | Package config, dependencies (matches claim-drafter pattern) |
| `src/__init__.py` | Package marker |
| `src/server.py` | FastAPI app: `/health`, `/check` (sync), `/check/stream` (SSE) |
| `src/models.py` | Pydantic models: `ComplianceRequest`, `ComplianceResponse`, `ComplianceResultItem`, `GraphState` |
| `src/cost.py` | Per-check cost tracking (copy from claim-drafter — identical logic) |
| `src/graph.py` | LangGraph pipeline: run all 4 checkers sequentially, aggregate results |
| `src/agents/__init__.py` | Package marker |
| `src/agents/written_description.py` | 35 USC 112(a) written description checker |
| `src/agents/definiteness.py` | 35 USC 112(b) definiteness checker |
| `src/agents/formalities.py` | MPEP 608 formalities checker |
| `src/agents/eligibility.py` | 35 USC 101 eligibility checker |
| `src/prompts/common-rules.md` | Shared compliance instructions + UPL disclaimers |
| `src/prompts/written-description.md` | 112(a) prompt template |
| `src/prompts/definiteness.md` | 112(b) prompt template |
| `src/prompts/formalities.md` | MPEP 608 prompt template |
| `src/prompts/eligibility.md` | 101 prompt template |
| `tests/__init__.py` | Test package marker |
| `tests/test_models.py` | Pydantic model validation tests |
| `tests/test_cost.py` | Cost estimation tests |
| `tests/test_graph.py` | Graph routing and aggregation tests |
| `tests/test_written_description.py` | Written description agent tests (mocked Anthropic) |
| `tests/test_definiteness.py` | Definiteness agent tests (mocked Anthropic) |
| `tests/test_formalities.py` | Formalities agent tests (mocked Anthropic) |
| `tests/test_eligibility.py` | Eligibility agent tests (mocked Anthropic) |
| `tests/test_auth.py` | Internal service auth tests |
| `tests/test_server.py` | Endpoint validation tests |

### New Files — Backend (`backend/src/compliance/`)

| File | Responsibility |
|------|---------------|
| `compliance.module.ts` | NestJS module declaration |
| `compliance.controller.ts` | REST endpoints: POST check, GET latest, GET by version |
| `compliance.service.ts` | Orchestration: validate claims exist → call service → persist results |
| `compliance.spec.ts` | Jest tests for service + controller |
| `dto/start-compliance.dto.ts` | Request validation DTO |

### New Files — Frontend (`frontend/src/components/`)

| File | Responsibility |
|------|---------------|
| `ComplianceTab.tsx` | Compliance tab component (5 states, traffic-light results) |
| `ComplianceTab.test.tsx` | Vitest tests for all 5 states |

### Modified Files

| File | What Changes |
|------|-------------|
| `frontend/src/api.ts` | Add `compliance` API methods + `claimDraft.regenerate` method |
| `frontend/src/pages/ProjectDetail.tsx` | Add Compliance tab, add regenerate button to claims |
| `frontend/src/components/ClaimsTab.tsx` | Add regenerate button per claim, prior art overlap indicators |
| `backend/src/app.module.ts` | Import `ComplianceModule` |
| `backend/src/claim-draft/claim-draft.controller.ts` | Add `POST claims/:claimNumber/regenerate` endpoint |
| `backend/src/claim-draft/claim-draft.service.ts` | Add `regenerateClaim()` method |
| `docker-compose.yml` | Add compliance-checker service (port 3004) |
| `frontend/playwright.config.ts` | Add compliance-checker to webServer list |

### Prisma Schema

The `ComplianceCheck` and `ComplianceResult` models already exist with all needed fields. **No migration required.**

---

## Task 1: Compliance Checker Service — Models and Cost

**Files:**
- Create: `services/compliance-checker/pyproject.toml`
- Create: `services/compliance-checker/src/__init__.py`
- Create: `services/compliance-checker/src/models.py`
- Create: `services/compliance-checker/src/cost.py`
- Create: `services/compliance-checker/tests/__init__.py`
- Create: `services/compliance-checker/tests/test_models.py`
- Create: `services/compliance-checker/tests/test_cost.py`

- [ ] **Step 1: Create pyproject.toml**

```toml
[project]
name = "patentforge-compliance-checker"
version = "0.5.0"
description = "Patent claim compliance checking service for PatentForge"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0,<1.0",
    "uvicorn[standard]>=0.34.0,<1.0",
    "langgraph>=0.3.0,<1.0",
    "anthropic>=0.42.0,<1.0",
    "pydantic>=2.0,<3.0",
    "sse-starlette>=2.0,<3.0",
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

- [ ] **Step 2: Create src/__init__.py and tests/__init__.py**

Both files are empty (package markers).

- [ ] **Step 3: Write failing tests for models**

Create `tests/test_models.py`:

```python
"""Tests for compliance checker Pydantic models."""

import pytest
from pydantic import ValidationError

from src.models import (
    ClaimItem,
    ComplianceSettings,
    ComplianceRequest,
    ComplianceResultItem,
    ComplianceResponse,
)


class TestClaimItem:
    def test_valid_claim(self):
        c = ClaimItem(claim_number=1, claim_type="INDEPENDENT", text="A method comprising...")
        assert c.claim_number == 1
        assert c.claim_type == "INDEPENDENT"

    def test_missing_text(self):
        with pytest.raises(ValidationError):
            ClaimItem(claim_number=1, claim_type="INDEPENDENT", text="")


class TestComplianceSettings:
    def test_model_required(self):
        s = ComplianceSettings(default_model="claude-sonnet-4-20250514")
        assert s.api_key == ""
        assert s.max_tokens == 16000

    def test_missing_model_fails(self):
        with pytest.raises(ValidationError):
            ComplianceSettings()


class TestComplianceRequest:
    def test_valid_request(self):
        req = ComplianceRequest(
            claims=[ClaimItem(claim_number=1, claim_type="INDEPENDENT", text="A method")],
            specification_text="The invention relates to...",
            invention_narrative="A system that...",
            settings=ComplianceSettings(default_model="claude-sonnet-4-20250514"),
        )
        assert len(req.claims) == 1

    def test_empty_claims_fails(self):
        with pytest.raises(ValidationError):
            ComplianceRequest(
                claims=[],
                specification_text="",
                invention_narrative="",
                settings=ComplianceSettings(default_model="claude-sonnet-4-20250514"),
            )

    def test_max_claims_cap(self):
        claims = [ClaimItem(claim_number=i, claim_type="INDEPENDENT", text=f"Claim {i}") for i in range(1, 52)]
        with pytest.raises(ValidationError, match="Maximum 50 claims"):
            ComplianceRequest(
                claims=claims,
                specification_text="",
                invention_narrative="",
                settings=ComplianceSettings(default_model="claude-sonnet-4-20250514"),
            )


class TestComplianceResultItem:
    def test_valid_result(self):
        r = ComplianceResultItem(
            rule="112b_definiteness",
            status="FAIL",
            claim_number=2,
            detail="'the processing unit' lacks antecedent basis",
            citation="MPEP 2173.05(e)",
            suggestion="Add 'a processing unit' to claim 1",
        )
        assert r.status == "FAIL"

    def test_invalid_status(self):
        with pytest.raises(ValidationError):
            ComplianceResultItem(
                rule="112a", status="INVALID", detail="test"
            )


class TestComplianceResponse:
    def test_overall_pass_computed(self):
        r = ComplianceResponse(
            results=[
                ComplianceResultItem(rule="112a", status="PASS", detail="OK"),
                ComplianceResultItem(rule="112b", status="PASS", detail="OK"),
            ],
        )
        assert r.overall_pass is True

    def test_overall_fail_on_any_fail(self):
        r = ComplianceResponse(
            results=[
                ComplianceResultItem(rule="112a", status="PASS", detail="OK"),
                ComplianceResultItem(rule="112b", status="FAIL", detail="Bad"),
            ],
        )
        assert r.overall_pass is False
```

- [ ] **Step 4: Run tests — verify they fail**

```bash
cd services/compliance-checker && pip install -e ".[dev]" && pytest tests/test_models.py -v
```

Expected: ModuleNotFoundError — `src.models` does not exist yet.

- [ ] **Step 5: Implement models**

Create `src/models.py`:

```python
"""
Pydantic models for the compliance checking service.
Defines request/response schemas and the LangGraph state.
"""

from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field, field_validator


# ── Request models ────────────────────────────────────────────────────────────

class ClaimItem(BaseModel):
    """A single patent claim to check."""
    claim_number: int
    claim_type: Literal["INDEPENDENT", "DEPENDENT"]
    parent_claim_number: int | None = None
    text: str = Field(min_length=1, max_length=10_000)


class ComplianceSettings(BaseModel):
    """User settings forwarded from the backend."""
    api_key: str = ""
    default_model: str
    research_model: str = ""
    max_tokens: int = 16000


class ComplianceRequest(BaseModel):
    """Input to the compliance checking pipeline."""
    claims: list[ClaimItem] = Field(min_length=1)
    specification_text: str = Field(default="", max_length=200_000)
    invention_narrative: str = Field(default="", max_length=100_000)
    prior_art_context: str = Field(default="", max_length=50_000)
    settings: ComplianceSettings

    @field_validator('claims')
    @classmethod
    def cap_claims(cls, v: list[ClaimItem]) -> list[ClaimItem]:
        if len(v) > 50:
            raise ValueError('Maximum 50 claims allowed')
        return v


# ── Output models ─────────────────────────────────────────────────────────────

class ComplianceResultItem(BaseModel):
    """A single compliance check result."""
    rule: str  # e.g. "112a_written_description", "112b_definiteness"
    status: Literal["PASS", "FAIL", "WARN"]
    claim_number: int | None = None
    detail: str
    citation: str | None = None
    suggestion: str | None = None


class ComplianceResponse(BaseModel):
    """Complete output of the compliance checking pipeline."""
    results: list[ComplianceResultItem] = Field(default_factory=list)
    overall_pass: bool = False
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_estimated_cost_usd: float = 0.0
    status: Literal["COMPLETE", "ERROR"] = "COMPLETE"
    error_message: str | None = None

    def model_post_init(self, __context) -> None:
        """Compute overall_pass from results."""
        if self.results:
            self.overall_pass = all(r.status != "FAIL" for r in self.results)


# ── LangGraph state ──────────────────────────────────────────────────────────

class GraphState(BaseModel):
    """Shared state for the compliance checking LangGraph pipeline."""
    # Inputs
    claims_text: str = ""
    specification_text: str = ""
    invention_narrative: str = ""
    prior_art_context: str = ""
    api_key: str = ""
    default_model: str = ""
    max_tokens: int = 16000

    # Per-checker outputs (JSON strings of ComplianceResultItem lists)
    written_description_results: str = "[]"
    definiteness_results: str = "[]"
    formalities_results: str = "[]"
    eligibility_results: str = "[]"

    # Cost tracking
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_estimated_cost_usd: float = 0.0

    # Pipeline control
    step: str = "init"
    error: str | None = None
```

- [ ] **Step 6: Write failing tests for cost**

Create `tests/test_cost.py`:

```python
"""Tests for cost estimation."""

from src.cost import estimate_cost


def test_sonnet_cost():
    cost = estimate_cost("claude-sonnet-4-20250514", 10000, 5000)
    expected = (10000 / 1_000_000) * 3.00 + (5000 / 1_000_000) * 15.00
    assert abs(cost - expected) < 0.000001


def test_haiku_cost():
    cost = estimate_cost("claude-haiku-4-5-20251001", 10000, 5000)
    expected = (10000 / 1_000_000) * 0.80 + (5000 / 1_000_000) * 4.00
    assert abs(cost - expected) < 0.000001


def test_unknown_model_uses_default():
    cost = estimate_cost("unknown-model", 10000, 5000)
    expected = (10000 / 1_000_000) * 3.00 + (5000 / 1_000_000) * 15.00
    assert abs(cost - expected) < 0.000001


def test_zero_tokens():
    assert estimate_cost("claude-sonnet-4-20250514", 0, 0) == 0.0
```

- [ ] **Step 7: Implement cost.py**

Create `src/cost.py` (identical to claim-drafter):

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

- [ ] **Step 8: Run all tests — verify they pass**

```bash
cd services/compliance-checker && pytest tests/ -v
```

Expected: All tests in test_models.py and test_cost.py PASS.

- [ ] **Step 9: Commit**

```bash
git add services/compliance-checker/
git commit -m "feat(compliance): add compliance-checker service models and cost estimation

New Python service for patent claim compliance checking.
Pydantic models for request/response, LangGraph state, and cost tracking.
Mirrors claim-drafter service patterns."
```

---

## Task 2: Compliance Checker — Prompt Templates

**Files:**
- Create: `services/compliance-checker/src/prompts/common-rules.md`
- Create: `services/compliance-checker/src/prompts/written-description.md`
- Create: `services/compliance-checker/src/prompts/definiteness.md`
- Create: `services/compliance-checker/src/prompts/formalities.md`
- Create: `services/compliance-checker/src/prompts/eligibility.md`

- [ ] **Step 1: Create common-rules.md**

```markdown
# Common Rules — Compliance Checking

You are a patent compliance analysis assistant. You are NOT a patent attorney. You do NOT provide legal advice. You help inventors identify potential issues in their patent claim drafts for educational and research purposes only.

## Output Format

For each issue found, output a JSON object on its own line with these fields:
- `rule`: The rule identifier (provided in your specific instructions)
- `status`: One of "PASS", "FAIL", or "WARN"
- `claim_number`: The claim number this applies to (integer), or null for specification-level issues
- `detail`: A clear, specific explanation of the issue or confirmation of compliance
- `citation`: The relevant MPEP section or USC reference (e.g., "MPEP 2173.05(e)")
- `suggestion`: A specific, actionable recommendation for fixing the issue (null if status is PASS)

Wrap all results in a JSON array inside a ```json code block.

## Rules

1. Analyze EVERY claim individually — do not skip claims or batch results.
2. For each claim, clearly state whether it PASSES, FAILS, or generates a WARNING.
3. PASS means the claim clearly satisfies the requirement.
4. FAIL means the claim has a definite deficiency.
5. WARN means the claim has a potential issue that an examiner might raise.
6. Always cite the specific MPEP section or USC provision.
7. Be specific — reference exact words or phrases from the claim text.
8. Suggestions must be actionable — tell the inventor exactly what to change.
9. This analysis is for research purposes only. Include this disclaimer in your response:
   "This compliance check is AI-generated research output, not legal advice."
```

- [ ] **Step 2: Create written-description.md**

```markdown
# 35 USC 112(a) — Written Description Check

Evaluate whether the specification (invention narrative + specification text) provides adequate written description support for each claim element.

## What to Check

For each claim:
1. Identify every element, limitation, and term in the claim
2. For each element, verify it is described in the specification
3. Flag elements that appear in claims but have no corresponding description
4. Check that the specification conveys that the inventor had possession of the claimed invention

## Rule Identifier

Use `rule: "112a_written_description"` for all results from this check.

## Common Issues

- Claim recites a component not mentioned in the specification
- Claim uses a term with no definition or explanation in the spec
- Claim scope is broader than what the specification describes
- New matter: claim element added after original filing with no spec support
- Functional language ("configured to", "adapted to") without structural support

## MPEP References

- MPEP 2163 — Guidelines for the Written Description Requirement
- MPEP 2163.02 — Standard for Determining Compliance
- MPEP 2163.05 — Changes to the Scope of Claims
```

- [ ] **Step 3: Create definiteness.md**

```markdown
# 35 USC 112(b) — Definiteness Check

Evaluate whether each claim clearly defines the scope of the invention so that a person of ordinary skill in the art can understand what is claimed.

## What to Check

For each claim:
1. **Antecedent basis**: Every "the [noun]" or "said [noun]" must have a prior "a [noun]" or "an [noun]" introduction, either in this claim or in a parent claim it depends on.
2. **Relative terms**: Flag "substantially", "approximately", "about", "similar to" — these are WARN unless the specification defines them precisely.
3. **Functional language without structure**: "means for [function]" triggers 112(f) and requires corresponding structure in the specification.
4. **Ambiguous scope**: Terms that could reasonably be interpreted two different ways.
5. **Inconsistent terminology**: Same element called different names in different claims.
6. **Dangling dependencies**: Dependent claims referencing a parent that doesn't exist.

## Rule Identifier

Use `rule: "112b_definiteness"` for all results from this check.

## MPEP References

- MPEP 2173 — Claims Must Particularly Point Out and Distinctly Claim
- MPEP 2173.02 — Clarity and Precision
- MPEP 2173.05(a) — New Terminology
- MPEP 2173.05(b) — Relative Terminology
- MPEP 2173.05(d) — Exemplary Claim Language ("such as", "for example")
- MPEP 2173.05(e) — Lack of Antecedent Basis
```

- [ ] **Step 4: Create formalities.md**

```markdown
# MPEP 608 — Formalities Check

Evaluate whether the claims follow USPTO formal requirements for patent claim drafting.

## What to Check

1. **Single sentence**: Each claim must be a single sentence (period only at the end).
2. **Claim numbering**: Claims must be numbered consecutively starting from 1.
3. **Dependency chains**: Dependent claims must reference a prior claim. Chains deeper than 3 levels are valid but generate a WARN.
4. **Preamble-body structure**: Independent claims should have a preamble ("A method for...") and a body ("comprising: ...").
5. **Transitional phrases**: Check for proper use of "comprising" (open-ended), "consisting of" (closed), "consisting essentially of" (semi-closed).
6. **Proper dependency format**: Dependent claims should start with "The [preamble of parent] of claim [N]" or "The [preamble] according to claim [N]".
7. **No duplicate claims**: Flag claims that are substantively identical.
8. **Independent claim count**: More than 3 independent claims generates a WARN (USPTO surcharge at 4+).

## Rule Identifier

Use `rule: "mpep_608_formalities"` for all results from this check.

## MPEP References

- MPEP 608.01(m) — Form of Claims
- MPEP 608.01(n) — Dependent Claims
- MPEP 608.01(i) — Numbering of Claims
- 37 CFR 1.75 — Claim Requirements
```

- [ ] **Step 5: Create eligibility.md**

```markdown
# 35 USC 101 — Patent Eligibility Check (Alice/Mayo)

Evaluate whether each independent claim is directed to patent-eligible subject matter under the Alice/Mayo two-step framework.

## The Two-Step Test

**Step 1 — Abstract Idea?**
Is the claim directed to an abstract idea, law of nature, or natural phenomenon?
Categories of abstract ideas:
- Mathematical concepts (formulas, calculations, algorithms)
- Methods of organizing human activity (contracts, advertising, social activities)
- Mental processes (observation, evaluation, judgment that could be performed in the human mind)

If NOT directed to an abstract idea → PASS (stop here).

**Step 2 — Significantly More?**
If directed to an abstract idea, does the claim recite additional elements that amount to "significantly more" than the abstract idea itself?
Elements that are NOT significantly more:
- Adding "on a computer" or "using a processor"
- Mere data gathering
- Selecting by type or source of data
- Generic computer implementation
Elements that ARE significantly more:
- Specific technical improvement to computer functionality
- Specific machine or transformation
- Unconventional combination of steps
- Specific application of the abstract idea

## Rule Identifier

Use `rule: "101_eligibility"` for all results from this check.

## Special Notes

- Only check INDEPENDENT claims (dependent claims inherit parent's eligibility)
- AI/ML inventions are particularly susceptible to 101 rejections
- Physical/hardware elements strengthen eligibility arguments
- Generate WARN for claims that pass Step 1 narrowly

## MPEP References

- MPEP 2106 — Patent Subject Matter Eligibility
- MPEP 2106.04 — Abstract Idea
- MPEP 2106.05 — Significantly More (Step 2B)
- Alice Corp. v. CLS Bank International, 573 U.S. 208 (2014)
```

- [ ] **Step 6: Commit**

```bash
git add services/compliance-checker/src/prompts/
git commit -m "feat(compliance): add compliance check prompt templates

Four checker prompts: 112(a) written description, 112(b) definiteness,
MPEP 608 formalities, 101 eligibility. Common rules define JSON output
format and UPL disclaimers. Licensed CC BY-SA 4.0 (matches claim-drafter)."
```

---

## Task 3: Compliance Checker — Four Checker Agents

**Files:**
- Create: `services/compliance-checker/src/agents/__init__.py`
- Create: `services/compliance-checker/src/agents/written_description.py`
- Create: `services/compliance-checker/src/agents/definiteness.py`
- Create: `services/compliance-checker/src/agents/formalities.py`
- Create: `services/compliance-checker/src/agents/eligibility.py`
- Create: `tests/test_written_description.py`
- Create: `tests/test_definiteness.py`
- Create: `tests/test_formalities.py`
- Create: `tests/test_eligibility.py`

- [ ] **Step 1: Write failing test for written_description agent**

Create `tests/test_written_description.py`:

```python
"""Tests for 112(a) written description checker agent."""

import json
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from src.agents.written_description import run_written_description
from src.models import GraphState


@pytest.fixture
def base_state():
    return GraphState(
        claims_text="1. A method comprising: a processor executing instructions.",
        specification_text="The invention uses a processor to execute instructions.",
        invention_narrative="A system that processes data.",
        api_key="test-key",
        default_model="claude-sonnet-4-20250514",
    )


def _mock_response(text: str, input_tokens: int = 100, output_tokens: int = 200):
    response = MagicMock()
    response.content = [MagicMock(text=text)]
    response.usage = MagicMock(input_tokens=input_tokens, output_tokens=output_tokens)
    return response


class TestWrittenDescription:
    @patch("src.agents.written_description.anthropic.AsyncAnthropic")
    async def test_pass_result(self, mock_cls, base_state):
        result_json = json.dumps([{
            "rule": "112a_written_description",
            "status": "PASS",
            "claim_number": 1,
            "detail": "All elements supported",
            "citation": "MPEP 2163",
            "suggestion": None,
        }])
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=_mock_response(f"```json\n{result_json}\n```"))
        mock_cls.return_value = mock_client

        state = await run_written_description(base_state)

        results = json.loads(state.written_description_results)
        assert len(results) == 1
        assert results[0]["status"] == "PASS"
        assert state.total_input_tokens == 100
        assert state.total_output_tokens == 200

    @patch("src.agents.written_description.anthropic.AsyncAnthropic")
    async def test_fail_result(self, mock_cls, base_state):
        result_json = json.dumps([{
            "rule": "112a_written_description",
            "status": "FAIL",
            "claim_number": 1,
            "detail": "Element 'neural network' not in specification",
            "citation": "MPEP 2163",
            "suggestion": "Add description of neural network to specification",
        }])
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=_mock_response(f"```json\n{result_json}\n```"))
        mock_cls.return_value = mock_client

        state = await run_written_description(base_state)

        results = json.loads(state.written_description_results)
        assert results[0]["status"] == "FAIL"

    @patch("src.agents.written_description.anthropic.AsyncAnthropic")
    async def test_api_error_sets_state_error(self, mock_cls, base_state):
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(side_effect=Exception("API timeout"))
        mock_cls.return_value = mock_client

        state = await run_written_description(base_state)

        assert state.error is not None
        assert "API timeout" in state.error

    @patch("src.agents.written_description.anthropic.AsyncAnthropic")
    async def test_malformed_json_handled(self, mock_cls, base_state):
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=_mock_response("Not JSON at all"))
        mock_cls.return_value = mock_client

        state = await run_written_description(base_state)

        # Should not crash — should capture error or return empty results
        assert state.error is not None or state.written_description_results == "[]"

    @patch("src.agents.written_description.anthropic.AsyncAnthropic")
    async def test_cost_accumulated(self, mock_cls, base_state):
        base_state.total_input_tokens = 50
        base_state.total_output_tokens = 100
        result_json = json.dumps([{"rule": "112a_written_description", "status": "PASS", "claim_number": 1, "detail": "OK"}])
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=_mock_response(f"```json\n{result_json}\n```", 200, 300))
        mock_cls.return_value = mock_client

        state = await run_written_description(base_state)

        assert state.total_input_tokens == 250
        assert state.total_output_tokens == 400
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd services/compliance-checker && pytest tests/test_written_description.py -v
```

Expected: ModuleNotFoundError — `src.agents.written_description` does not exist.

- [ ] **Step 3: Implement written_description agent**

Create `src/agents/__init__.py` (empty).

Create `src/agents/written_description.py`:

```python
"""
Written Description Agent — 35 USC 112(a) check.

Evaluates whether the specification provides adequate written description
support for each claim element.
"""

from __future__ import annotations
import json
import re
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
    prompt_path = PROMPTS_DIR / "written-description.md"
    if prompt_path.exists():
        return common + prompt_path.read_text(encoding="utf-8")
    return common + "You are a patent compliance checker for 35 USC 112(a)."


def _extract_json(text: str) -> list[dict]:
    """Extract JSON array from LLM response (handles code block or raw JSON)."""
    # Try code block first
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    # Try raw JSON array
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError("No JSON array found in response")


async def run_written_description(state: GraphState) -> GraphState:
    """Check claims against 35 USC 112(a) written description requirement."""
    prompt = _load_prompt()
    model = state.default_model

    user_message = f"""## Claims to Check

{state.claims_text}

## Specification / Invention Description

{state.specification_text}

{state.invention_narrative}

---

Check each claim against 35 USC 112(a) written description requirements."""

    client = anthropic.AsyncAnthropic(api_key=state.api_key)

    try:
        response = await client.messages.create(
            model=model,
            max_tokens=state.max_tokens,
            system=prompt,
            messages=[{"role": "user", "content": user_message}],
            timeout=120.0,
        )
        output = response.content[0].text
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        state.total_input_tokens += input_tokens
        state.total_output_tokens += output_tokens
        state.total_estimated_cost_usd += estimate_cost(model, input_tokens, output_tokens)
    except Exception as e:
        state.error = f"Written description check failed: {e}"
        return state

    try:
        results = _extract_json(output)
        state.written_description_results = json.dumps(results)
    except (json.JSONDecodeError, ValueError) as e:
        state.error = f"Written description check returned invalid JSON: {e}"

    state.step = "written_description_complete"
    return state
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd services/compliance-checker && pytest tests/test_written_description.py -v
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Implement definiteness, formalities, and eligibility agents**

Create `src/agents/definiteness.py`, `src/agents/formalities.py`, and `src/agents/eligibility.py`. Each follows the identical pattern as `written_description.py` with these differences:

**definiteness.py:**
- Function name: `run_definiteness`
- Prompt file: `definiteness.md`
- State field: `state.definiteness_results`
- Step name: `"definiteness_complete"`
- Error prefix: `"Definiteness check failed:"`

**formalities.py:**
- Function name: `run_formalities`
- Prompt file: `formalities.md`
- State field: `state.formalities_results`
- Step name: `"formalities_complete"`
- Error prefix: `"Formalities check failed:"`

**eligibility.py:**
- Function name: `run_eligibility`
- Prompt file: `eligibility.md`
- State field: `state.eligibility_results`
- Step name: `"eligibility_complete"`
- Error prefix: `"Eligibility check failed:"`

Each agent uses the same `_load_prompt()` and `_extract_json()` helper pattern. The only differences are the prompt filename, the state field they write to, and the step name.

- [ ] **Step 6: Write and run tests for all three remaining agents**

Create `tests/test_definiteness.py`, `tests/test_formalities.py`, `tests/test_eligibility.py`. Each follows the same pattern as `test_written_description.py` with the appropriate function, state field, and rule identifier. Each needs at minimum:
- `test_pass_result` — mock PASS response, verify parsed correctly
- `test_fail_result` — mock FAIL response, verify parsed correctly
- `test_api_error_sets_state_error` — mock exception, verify state.error set
- `test_malformed_json_handled` — non-JSON response, verify graceful handling
- `test_cost_accumulated` — verify token counts add to existing totals

```bash
cd services/compliance-checker && pytest tests/ -v
```

Expected: All tests in all test files PASS (20+ tests).

- [ ] **Step 7: Commit**

```bash
git add services/compliance-checker/src/agents/ services/compliance-checker/tests/
git commit -m "feat(compliance): add four compliance checker agents

112(a) written description, 112(b) definiteness, MPEP 608 formalities,
101 eligibility. Each agent calls Anthropic with a specialized prompt,
parses structured JSON results, and tracks cost. All mocked tests pass."
```

---

## Task 4: Compliance Checker — LangGraph Pipeline and Server

**Files:**
- Create: `services/compliance-checker/src/graph.py`
- Create: `services/compliance-checker/src/server.py`
- Create: `tests/test_graph.py`
- Create: `tests/test_auth.py`
- Create: `tests/test_server.py`

- [ ] **Step 1: Write failing test for graph**

Create `tests/test_graph.py`:

```python
"""Tests for compliance checking LangGraph pipeline."""

import json
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from src.graph import run_compliance_pipeline
from src.models import ComplianceResponse


def _mock_agent(field_name: str, results: list[dict]):
    """Create a mock agent that sets the given state field."""
    async def agent(state):
        setattr(state, field_name, json.dumps(results))
        state.total_input_tokens += 100
        state.total_output_tokens += 200
        return state
    return agent


class TestCompliancePipeline:
    @patch("src.graph.run_eligibility")
    @patch("src.graph.run_formalities")
    @patch("src.graph.run_definiteness")
    @patch("src.graph.run_written_description")
    async def test_all_checks_run(self, mock_wd, mock_def, mock_form, mock_elig):
        pass_result = [{"rule": "test", "status": "PASS", "claim_number": 1, "detail": "OK"}]
        mock_wd.side_effect = _mock_agent("written_description_results", pass_result)
        mock_def.side_effect = _mock_agent("definiteness_results", pass_result)
        mock_form.side_effect = _mock_agent("formalities_results", pass_result)
        mock_elig.side_effect = _mock_agent("eligibility_results", pass_result)

        result = await run_compliance_pipeline(
            claims_text="1. A method.",
            specification_text="The invention...",
            invention_narrative="A system.",
            api_key="test-key",
            default_model="claude-sonnet-4-20250514",
        )

        assert isinstance(result, ComplianceResponse)
        assert result.status == "COMPLETE"
        assert len(result.results) == 4  # One per checker
        assert result.overall_pass is True

    @patch("src.graph.run_eligibility")
    @patch("src.graph.run_formalities")
    @patch("src.graph.run_definiteness")
    @patch("src.graph.run_written_description")
    async def test_failure_in_one_check_continues(self, mock_wd, mock_def, mock_form, mock_elig):
        fail_result = [{"rule": "112b", "status": "FAIL", "claim_number": 1, "detail": "Bad"}]
        pass_result = [{"rule": "test", "status": "PASS", "claim_number": 1, "detail": "OK"}]
        mock_wd.side_effect = _mock_agent("written_description_results", pass_result)
        mock_def.side_effect = _mock_agent("definiteness_results", fail_result)
        mock_form.side_effect = _mock_agent("formalities_results", pass_result)
        mock_elig.side_effect = _mock_agent("eligibility_results", pass_result)

        result = await run_compliance_pipeline(
            claims_text="1. A method.",
            specification_text="",
            invention_narrative="",
            api_key="test-key",
            default_model="claude-sonnet-4-20250514",
        )

        assert result.overall_pass is False
        assert any(r.status == "FAIL" for r in result.results)

    @patch("src.graph.run_eligibility")
    @patch("src.graph.run_formalities")
    @patch("src.graph.run_definiteness")
    @patch("src.graph.run_written_description")
    async def test_cost_aggregated(self, mock_wd, mock_def, mock_form, mock_elig):
        pass_result = [{"rule": "test", "status": "PASS", "claim_number": 1, "detail": "OK"}]
        mock_wd.side_effect = _mock_agent("written_description_results", pass_result)
        mock_def.side_effect = _mock_agent("definiteness_results", pass_result)
        mock_form.side_effect = _mock_agent("formalities_results", pass_result)
        mock_elig.side_effect = _mock_agent("eligibility_results", pass_result)

        result = await run_compliance_pipeline(
            claims_text="1. A method.",
            specification_text="",
            invention_narrative="",
            api_key="test-key",
            default_model="claude-sonnet-4-20250514",
        )

        assert result.total_input_tokens == 400  # 4 agents x 100
        assert result.total_output_tokens == 800  # 4 agents x 200
```

- [ ] **Step 2: Implement graph.py**

Create `src/graph.py`:

```python
"""
LangGraph state machine for the compliance checking pipeline.

Flow: written_description → definiteness → formalities → eligibility → finalize
"""

from __future__ import annotations
import json
from typing import Callable

from langgraph.graph import StateGraph, END

from .models import GraphState, ComplianceResponse, ComplianceResultItem
from .agents.written_description import run_written_description
from .agents.definiteness import run_definiteness
from .agents.formalities import run_formalities
from .agents.eligibility import run_eligibility


async def finalize(state: GraphState) -> GraphState:
    """Aggregate results from all checkers. Scrub API key."""
    state.api_key = ""
    state.step = "finalize_complete"
    return state


def build_graph() -> StateGraph:
    """Build the compliance checking pipeline."""
    graph = StateGraph(GraphState)

    graph.add_node("written_description", run_written_description)
    graph.add_node("definiteness", run_definiteness)
    graph.add_node("formalities", run_formalities)
    graph.add_node("eligibility", run_eligibility)
    graph.add_node("finalize", finalize)

    graph.set_entry_point("written_description")
    graph.add_edge("written_description", "definiteness")
    graph.add_edge("definiteness", "formalities")
    graph.add_edge("formalities", "eligibility")
    graph.add_edge("eligibility", "finalize")
    graph.add_edge("finalize", END)

    return graph


compliance_pipeline = build_graph().compile()


async def run_compliance_pipeline(
    claims_text: str,
    specification_text: str,
    invention_narrative: str,
    api_key: str,
    default_model: str,
    prior_art_context: str = "",
    max_tokens: int = 16000,
    on_step: Callable[[str, str], None] | None = None,
) -> ComplianceResponse:
    """Run all four compliance checks and return aggregated results."""
    initial_state = GraphState(
        claims_text=claims_text,
        specification_text=specification_text,
        invention_narrative=invention_narrative,
        prior_art_context=prior_art_context,
        api_key=api_key,
        default_model=default_model,
        max_tokens=max_tokens,
    )

    state_dict: dict = initial_state.model_dump()
    async for step_output in compliance_pipeline.astream(state_dict):
        for node_name, node_state in step_output.items():
            if isinstance(node_state, dict):
                state_dict = node_state
            else:
                state_dict = node_state.model_dump() if hasattr(node_state, 'model_dump') else dict(node_state)
            if on_step:
                on_step(node_name, state_dict.get("step", ""))
            # Don't abort on error — continue to remaining checks
            # Individual check errors are captured in their result fields

    # Aggregate results from all checkers
    all_results: list[ComplianceResultItem] = []
    for field in ["written_description_results", "definiteness_results", "formalities_results", "eligibility_results"]:
        raw = state_dict.get(field, "[]")
        try:
            items = json.loads(raw) if isinstance(raw, str) else raw
            for item in items:
                all_results.append(ComplianceResultItem(**item) if isinstance(item, dict) else item)
        except (json.JSONDecodeError, TypeError):
            pass  # Skip malformed results

    return ComplianceResponse(
        results=all_results,
        total_input_tokens=state_dict.get("total_input_tokens", 0),
        total_output_tokens=state_dict.get("total_output_tokens", 0),
        total_estimated_cost_usd=state_dict.get("total_estimated_cost_usd", 0.0),
        status="COMPLETE",
    )
```

- [ ] **Step 3: Write and implement server.py, test_auth.py, test_server.py**

Create `src/server.py` following the exact same pattern as `services/claim-drafter/src/server.py`:
- `/health` endpoint with prompt hashes
- `/check` POST endpoint (sync) that calls `run_compliance_pipeline`
- Internal service auth via `X-Internal-Secret` header
- CORS locked to `localhost:3000`
- Port 3004 by default

Create `tests/test_auth.py` (3 tests: auth disabled when no secret, auth rejects bad secret, auth accepts correct secret).

Create `tests/test_server.py` (3 tests: health returns OK, check requires valid request body, check returns 422 on empty claims).

- [ ] **Step 4: Run all compliance-checker tests**

```bash
cd services/compliance-checker && pytest tests/ -v
```

Expected: All tests PASS (~35-40 tests total).

- [ ] **Step 5: Commit**

```bash
git add services/compliance-checker/src/graph.py services/compliance-checker/src/server.py services/compliance-checker/tests/
git commit -m "feat(compliance): add LangGraph pipeline and FastAPI server

Four-check sequential pipeline: 112(a) → 112(b) → MPEP 608 → 101.
Results aggregated into ComplianceResponse. Server on port 3004 with
internal service auth and CORS. All tests pass."
```

---

## Task 5: Backend — Compliance Module

**Files:**
- Create: `backend/src/compliance/compliance.module.ts`
- Create: `backend/src/compliance/compliance.controller.ts`
- Create: `backend/src/compliance/compliance.service.ts`
- Create: `backend/src/compliance/compliance.spec.ts`
- Create: `backend/src/compliance/dto/start-compliance.dto.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Write failing test**

Create `backend/src/compliance/compliance.spec.ts` with tests for:
- `startCheck` — validates claims exist, calls service, creates ComplianceCheck record
- `startCheck` — returns 404 when no claims exist
- `startCheck` — returns 409 when a check is already RUNNING
- `getLatest` — returns latest ComplianceCheck with results
- `getLatest` — returns `{ status: 'NONE' }` when no checks exist
- `getByVersion` — returns specific version
- `getByVersion` — returns 404 for nonexistent version

Follow the pattern from `backend/src/claim-draft/claim-draft.spec.ts`.

- [ ] **Step 2: Implement DTO**

Create `backend/src/compliance/dto/start-compliance.dto.ts`:

```typescript
import { IsOptional, IsNumber, Min, Max } from 'class-validator';

export class StartComplianceDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  draftVersion?: number;
}
```

- [ ] **Step 3: Implement compliance.service.ts**

Follow the claim-draft service pattern exactly:
- `onModuleInit()` — mark stuck RUNNING checks as ERROR
- `startCheck(projectId, draftVersion?)` — validate claims exist → enforce cost cap → build claims text + spec text → create ComplianceCheck record → fire-and-forget call to compliance service → return the check record
- `callComplianceChecker(checkId, requestBody)` — HTTP POST to compliance service `/check`, save results to `ComplianceResult` rows, update `ComplianceCheck` status
- `getLatest(projectId)` — return latest ComplianceCheck with results
- `getByVersion(projectId, version)` — return specific version

Service URL: `process.env.COMPLIANCE_CHECKER_URL || 'http://localhost:3004'`

- [ ] **Step 4: Implement compliance.controller.ts**

```typescript
import { Controller, Get, Post, Param, Body, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { StartComplianceDto } from './dto/start-compliance.dto';

@Controller('projects/:id/compliance')
export class ComplianceController {
  constructor(private readonly service: ComplianceService) {}

  @Post('check')
  @HttpCode(HttpStatus.CREATED)
  startCheck(
    @Param('id') projectId: string,
    @Body() dto: StartComplianceDto,
  ) {
    return this.service.startCheck(projectId, dto.draftVersion);
  }

  @Get()
  getLatest(@Param('id') projectId: string) {
    return this.service.getLatest(projectId);
  }

  @Get(':version')
  getByVersion(
    @Param('id') projectId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.service.getByVersion(projectId, version);
  }
}
```

- [ ] **Step 5: Implement compliance.module.ts and register in app.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
})
export class ComplianceModule {}
```

Add `ComplianceModule` to `app.module.ts` imports.

- [ ] **Step 6: Run backend tests**

```bash
cd backend && npm test
```

Expected: All existing tests still pass, plus new compliance tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/compliance/ backend/src/app.module.ts
git commit -m "feat(compliance): add NestJS compliance module

Controller, service, and DTO for compliance checking. Mirrors claim-draft
pattern: fire-and-forget HTTP call to Python service, persist results to
ComplianceCheck/ComplianceResult tables, cost cap enforcement."
```

---

## Task 6: Backend — Individual Claim Regeneration (CD-8)

**Files:**
- Modify: `backend/src/claim-draft/claim-draft.controller.ts`
- Modify: `backend/src/claim-draft/claim-draft.service.ts`
- Modify: `backend/src/claim-draft/claim-draft.spec.ts`

- [ ] **Step 1: Write failing test for regenerateClaim**

Add to `claim-draft.spec.ts`:
- `regenerateClaim` — calls claim drafter for single claim, replaces claim text
- `regenerateClaim` — returns 404 for nonexistent claim
- `regenerateClaim` — returns 404 when claim doesn't belong to project

- [ ] **Step 2: Add regenerate endpoint to controller**

```typescript
/** POST /api/projects/:id/claims/:claimNumber/regenerate */
@Post(':claimNumber/regenerate')
@HttpCode(HttpStatus.OK)
regenerateClaim(
  @Param('id') projectId: string,
  @Param('claimNumber', ParseIntPipe) claimNumber: number,
) {
  return this.service.regenerateClaim(projectId, claimNumber);
}
```

- [ ] **Step 3: Implement regenerateClaim in service**

Add `regenerateClaim(projectId, claimNumber)` method:
1. Find the claim (via latest draft for project)
2. Get invention narrative + prior art context (same as startDraft)
3. Call claim drafter with instructions to regenerate only this claim
4. Parse result and update the claim text in DB
5. Return updated claim

- [ ] **Step 4: Run tests — verify pass**

```bash
cd backend && npm test
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/claim-draft/
git commit -m "feat(claims): add individual claim regeneration endpoint

POST /projects/:id/claims/:claimNumber/regenerate calls the claim drafter
to re-draft a single claim. Ownership verified. Existing claim text replaced."
```

---

## Task 7: Frontend — API Client Updates

**Files:**
- Modify: `frontend/src/api.ts`

- [ ] **Step 1: Add compliance and regenerate methods to api.ts**

Add to the `api` object:

```typescript
compliance: {
  startCheck: (projectId: string, draftVersion?: number) =>
    req<any>('POST', `/projects/${projectId}/compliance/check`, { draftVersion }),
  getLatest: (projectId: string) =>
    req<any>('GET', `/projects/${projectId}/compliance`),
  getVersion: (projectId: string, version: number) =>
    req<any>('GET', `/projects/${projectId}/compliance/${version}`),
},
```

Add to `claimDraft`:

```typescript
regenerateClaim: (projectId: string, claimNumber: number) =>
  req<any>('POST', `/projects/${projectId}/claims/${claimNumber}/regenerate`),
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api.ts
git commit -m "feat(frontend): add compliance and claim regeneration API methods"
```

---

## Task 8: Frontend — ComplianceTab Component

**Files:**
- Create: `frontend/src/components/ComplianceTab.tsx`
- Create: `frontend/src/components/ComplianceTab.test.tsx`
- Modify: `frontend/src/pages/ProjectDetail.tsx`

- [ ] **Step 1: Write failing Vitest tests for ComplianceTab**

Create `frontend/src/components/ComplianceTab.test.tsx` with tests for all 5 states:
1. No claims → shows "Draft claims first" message
2. Ready → shows "Run Compliance Check" button
3. Running → shows spinner with active check name
4. Complete with all PASS → shows green traffic-light summary
5. Complete with FAIL → shows red traffic-light with details and suggestions
6. Error → shows error message with retry button
7. Re-check button enabled after claim edits

- [ ] **Step 2: Implement ComplianceTab.tsx**

Follow the ClaimsTab pattern exactly:
- Props: `projectId`, `hasClaims` (boolean)
- Five states: no-claims, ready, running (poll every 3s), complete, error
- UPL acknowledgment modal before first run
- "RESEARCH OUTPUT — NOT LEGAL ADVICE" header on results
- Traffic-light results: expandable sections per check rule
- Each result shows: status icon (checkmark/X/warning), claim number, detail, citation, suggestion
- "Re-check" button always visible when results exist
- Per-check cost display at bottom

- [ ] **Step 3: Add ComplianceTab to ProjectDetail.tsx**

Add a "Compliance" tab alongside the existing Feasibility, Prior Art, and Claims tabs. Pass `hasClaims` prop based on whether a completed claim draft exists.

- [ ] **Step 4: Run frontend tests**

```bash
cd frontend && npm test
```

Expected: All existing + new tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ComplianceTab.tsx frontend/src/components/ComplianceTab.test.tsx frontend/src/pages/ProjectDetail.tsx
git commit -m "feat(frontend): add ComplianceTab with traffic-light results

Five states: no-claims, ready, running, complete, error. UPL modal,
expandable results per check, MPEP citations, suggestions, re-check button."
```

---

## Task 9: Frontend — Claim Regeneration and Prior Art Overlap (CD-8, CD-9)

**Files:**
- Modify: `frontend/src/components/ClaimsTab.tsx`

- [ ] **Step 1: Add regenerate button to each claim**

Add a "Regenerate" button on each claim card. When clicked:
1. Show loading spinner on that claim
2. Call `api.claimDraft.regenerateClaim(projectId, claimNumber)`
3. On success, reload the draft to show updated claim text
4. On error, show inline error message

- [ ] **Step 2: Add prior art overlap indicators**

When rendering claims, check if any claim text contains terms that overlap with prior art titles or abstracts (simple substring match). Show a small warning icon with tooltip: "Potential overlap with [patent number]".

This is a client-side heuristic — not a backend API call. Load prior art results from the existing prior art panel data.

- [ ] **Step 3: Run frontend tests**

```bash
cd frontend && npm test
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ClaimsTab.tsx
git commit -m "feat(claims): add per-claim regeneration and prior art overlap warnings

Regenerate button calls claim drafter for single claim replacement.
Prior art overlap shown as warning icons with tooltip on matching terms."
```

---

## Task 10: Docker Compose and Playwright Config

**Files:**
- Modify: `docker-compose.yml`
- Modify: `frontend/playwright.config.ts`

- [ ] **Step 1: Add compliance-checker service to docker-compose.yml**

```yaml
compliance-checker:
  build: ./services/compliance-checker
  environment:
    ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
    INTERNAL_SERVICE_SECRET: ${INTERNAL_SERVICE_SECRET:-patentforge-internal}
    HOST: "0.0.0.0"
    PORT: "3004"
```

Add `COMPLIANCE_CHECKER_URL: http://compliance-checker:3004` to the backend environment.

Do NOT expose port 3004 to the host (internal service only).

- [ ] **Step 2: Create Dockerfile for compliance-checker**

Create `services/compliance-checker/Dockerfile` following the claim-drafter Dockerfile pattern.

- [ ] **Step 3: Add compliance-checker to Playwright webServer config**

Add the compliance-checker service to the webServer array in `frontend/playwright.config.ts`, matching the claim-drafter entry pattern.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml services/compliance-checker/Dockerfile frontend/playwright.config.ts
git commit -m "feat(infra): add compliance-checker to Docker Compose and Playwright

Port 3004, internal only (not exposed to host). INTERNAL_SERVICE_SECRET
pass-through. Playwright webServer config updated for E2E."
```

---

## Task 11: E2E Tests

**Files:**
- Create: `frontend/e2e/compliance.spec.ts`

- [ ] **Step 1: Write Playwright E2E tests**

Create `frontend/e2e/compliance.spec.ts` with these tests:
1. Compliance tab shows "Draft claims first" when no claims exist
2. Compliance tab shows "Run Compliance Check" when claims exist (mock claim draft)
3. Full flow: mock claims → run compliance → see results (use route interception to mock compliance-checker response)
4. Error handling: compliance service returns error → shows error message with retry
5. Re-check flow: see results → trigger re-check → see updated results

Follow the pattern from `frontend/e2e/feasibility-pipeline.spec.ts` — use route interception to mock the compliance-checker service responses.

- [ ] **Step 2: Run E2E tests**

```bash
cd frontend && npx playwright test e2e/compliance.spec.ts
```

Expected: All E2E tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/compliance.spec.ts
git commit -m "test(e2e): add compliance checking Playwright tests

5 tests: no-claims state, ready state, full flow with mocked service,
error handling, and re-check flow."
```

---

## Task 12: Documentation Updates

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `CONTRIBUTING.md`
- Modify: `USER-MANUAL.md`
- Modify: `docs/index.html`
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Update README.md**

- Add compliance checking to feature list
- Update architecture diagram (add compliance-checker service on port 3004)
- Check the v0.5 roadmap item
- Add compliance-checker to the "Install and Run" section
- Add `COMPLIANCE_CHECKER_URL` to configuration table

- [ ] **Step 2: Update CHANGELOG.md**

Add v0.5 entry with Added, Security sections covering:
- 35 USC 112(a), 112(b), MPEP 608, 101 compliance checks
- Traffic-light compliance report UI
- Individual claim regeneration
- Prior art overlap warnings
- Re-check after claim edits
- Compliance checker service (port 3004)

- [ ] **Step 3: Update CONTRIBUTING.md**

Add compliance-checker service setup instructions.

- [ ] **Step 4: Update USER-MANUAL.md**

Add new section explaining compliance checking in plain language.

- [ ] **Step 5: Update docs/index.html**

Add compliance checking to the feature list on the landing page.

- [ ] **Step 6: Update ARCHITECTURE.md**

Update to reflect the LLM-native approach (not RAG) for v0.5, note that RAG is a planned enhancement.

- [ ] **Step 7: Commit**

```bash
git add README.md CHANGELOG.md CONTRIBUTING.md USER-MANUAL.md docs/index.html ARCHITECTURE.md
git commit -m "docs: update all documentation for v0.5 compliance checking

README, CHANGELOG, CONTRIBUTING, USER-MANUAL, landing page, and
ARCHITECTURE.md updated with compliance features and service setup."
```

---

## Task 13: Version Bump and Full Test Suite

- [ ] **Step 1: Bump version to 0.5.0 in all locations**

- `services/compliance-checker/pyproject.toml` — already 0.5.0
- `backend/package.json` — bump to 0.5.0
- `frontend/package.json` — bump to 0.5.0
- `services/feasibility/package.json` — bump to 0.5.0
- `services/claim-drafter/pyproject.toml` — bump to 0.5.0
- `docker-compose.yml` — if version is referenced
- Check README.md for any version references

- [ ] **Step 2: Run full test suite**

```bash
# Backend
cd backend && npm test

# Frontend unit
cd frontend && npm test

# Compliance checker
cd services/compliance-checker && pytest tests/ -v

# Claim drafter (verify no regression)
cd services/claim-drafter && pytest tests/ -v

# E2E
cd frontend && npx playwright test
```

Expected: All tests pass across all services.

- [ ] **Step 3: Commit version bump**

```bash
git add -A
git commit -m "chore: bump version to 0.5.0 across all services"
```

---

## Summary

| Task | What | Est. New Tests |
|------|------|---------------|
| 1 | Models + cost | ~10 |
| 2 | Prompt templates | 0 (content only) |
| 3 | Four checker agents | ~20 |
| 4 | LangGraph pipeline + server | ~10 |
| 5 | NestJS compliance module | ~8 |
| 6 | Claim regeneration (CD-8) | ~3 |
| 7 | API client updates | 0 (thin wrappers) |
| 8 | ComplianceTab component | ~8 |
| 9 | Claim regen UI + overlap (CD-9) | ~3 |
| 10 | Docker + Playwright config | 0 (infra) |
| 11 | E2E tests | ~5 |
| 12 | Documentation | 0 (docs only) |
| 13 | Version bump + full suite | 0 (verification) |
| **Total** | | **~67 new tests** |

**Projected total: 279 existing + ~67 new = ~346 tests**
