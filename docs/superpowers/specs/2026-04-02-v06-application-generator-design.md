# v0.6 Design Spec: Patent Application Generator

**Date:** 2026-04-02
**Status:** Approved
**Version:** 0.6.0
**Baseline:** v0.5.2 (commit f4ad5a0)

---

## 1. Overview

v0.6 adds a patent application generator that assembles upstream artifacts (feasibility analysis, prior art, claims) into a complete USPTO-formatted patent application. Users can edit sections inline and export to Word (.docx) or Markdown.

### What v0.6 Delivers

- New Python microservice: 5 LLM agents generate application sections sequentially
- Backend integration: NestJS module with fire-and-forget pattern
- Frontend: ApplicationTab with section navigation, inline editing, export
- IDS (Information Disclosure Statement) generated from existing prior art data
- UPL disclaimer modal before generation
- No native PDF export (users save-as-PDF from Word)
- Minor schema addition: 5 nullable columns added to existing PatentApplication model (no structural migration)

### Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | Python | Matches claim-drafter/compliance-checker patterns; python-docx superior for document generation; zero marginal packaging cost for future installer |
| Architecture | Sequential pipeline with SSE (Approach C) | Fewer tokens than parallel (agents avoid repeating earlier sections); progress visible to user; simple to test/debug |
| PDF export | Skipped | Avoids ~50MB WeasyPrint dependency; users print-to-PDF from Word |
| Compliance gate | Not required | Claims must exist; compliance recommended but not mandatory |
| Rewrite roadmap | None | Installer packages existing stack (portable Node.js + embeddable Python + Inno Setup) — no runtime migration needed |

### Future Consideration

Post-v1.0: local LLM support (Ollama, LM Studio, vLLM). LLM calls are centralized per agent via `client.messages.create()` — keep this abstraction clean for future swap to OpenAI-compatible API.

---

## 2. Application Sections

A generated patent application contains these sections in order:

| # | Section | Source | LLM Agent? |
|---|---------|--------|------------|
| 1 | Title | InventionInput.title | No |
| 2 | Cross-References | User-editable placeholder | No |
| 3 | Background of the Invention | LLM: invention narrative + feasibility stage 1 + prior art context | Yes |
| 4 | Summary of the Invention | LLM: invention narrative + background output + claims text | Yes |
| 5 | Detailed Description | LLM: all prior sections + feasibility stages 5-6 + spec language from claim drafter | Yes |
| 6 | Claims | Pulled from ClaimDraft table (already formatted) | No |
| 7 | Abstract of the Disclosure | LLM: all prior sections + claims (150 words max, single paragraph) | Yes |
| 8 | Brief Description of Drawings | LLM: detailed description + claims | Yes |
| 9 | Information Disclosure Statement | Formatted from existing prior art results | No |

All sections receive USPTO paragraph numbering: [0001], [0002], etc. (except Claims, which use standard claim numbering).

---

## 3. Application Generator Service

### Location & Stack

```
services/application-generator/
├── pyproject.toml
├── Dockerfile
├── src/
│   ├── __init__.py
│   ├── server.py          # FastAPI app, endpoints, auth
│   ├── graph.py           # LangGraph pipeline definition
│   ├── models.py          # Pydantic request/response schemas
│   ├── cost.py            # Token cost estimation (shared pricing table)
│   ├── formatter.py       # USPTO paragraph numbering, IDS table
│   ├── exporter.py        # DOCX and Markdown export
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── background.py
│   │   ├── summary.py
│   │   ├── detailed_description.py
│   │   ├── abstract.py
│   │   └── figures.py
│   └── prompts/
│       ├── common-rules.md
│       ├── background.md
│       ├── summary.md
│       ├── detailed-description.md
│       ├── abstract.md
│       └── figures.md
└── tests/
    ├── test_auth.py
    ├── test_models.py
    ├── test_formatter.py
    ├── test_graph.py
    └── test_exporter.py
```

**Port:** 3003
**Dependencies:** fastapi, uvicorn[standard], langgraph, anthropic, pydantic, sse-starlette, python-docx

### Endpoints

**GET /health** (no auth)
```json
{
  "status": "ok",
  "service": "patentforge-application-generator",
  "version": "0.6.0",
  "promptHashes": {
    "common-rules": "sha256...",
    "background": "sha256...",
    "summary": "sha256...",
    "detailed-description": "sha256...",
    "abstract": "sha256...",
    "figures": "sha256..."
  }
}
```

**POST /generate** (SSE streaming, requires X-Internal-Secret)

Request body:
```json
{
  "invention_narrative": "string",
  "feasibility_stage_1": "string",
  "feasibility_stage_5": "string",
  "feasibility_stage_6": "string",
  "prior_art_results": [
    {
      "patent_number": "string",
      "title": "string",
      "abstract": "string",
      "relevance_score": 0.85,
      "claims_text": "string (optional)"
    }
  ],
  "claims_text": "string (formatted claims from ClaimDraft)",
  "spec_language": "string (from claim drafter)",
  "settings": {
    "api_key": "string (fallback, prefer env var)",
    "default_model": "string (required)",
    "research_model": "string (optional)",
    "max_tokens": 32000
  }
}
```

SSE events:
```
event: step
data: {"step": "background", "status": "complete"}

event: step
data: {"step": "summary", "status": "complete"}

...

event: complete
data: {"title": "...", "cross_references": "", "background": "...", "summary": "...", "detailed_description": "...", "claims": "...", "abstract": "...", "figure_descriptions": "...", "ids_table": "...", "total_input_tokens": 45000, "total_output_tokens": 12000, "total_estimated_cost_usd": 0.315, "status": "SUCCESS"}

event: error
data: {"message": "...", "step": "detailed_description"}
```

**POST /generate/sync** (blocking, requires X-Internal-Secret)

Same request body. Returns the complete result JSON directly.

**POST /export/docx** (requires X-Internal-Secret)

Request body: complete application sections (all fields from generate response).
Returns: DOCX file bytes.

**POST /export/markdown** (requires X-Internal-Secret)

Same request body. Returns: Markdown text.

### LangGraph Pipeline

```
Entry → background → summary → detailed_description → abstract → figures → format_ids → finalize → END
```

All edges are linear. No conditional branching.

**GraphState:**
```python
class GraphState(BaseModel):
    # Inputs
    invention_narrative: str
    feasibility_stage_1: str
    feasibility_stage_5: str
    feasibility_stage_6: str
    prior_art_context: str
    claims_text: str
    spec_language: str
    api_key: str                    # scrubbed in finalize
    default_model: str
    research_model: str = ""
    max_tokens: int = 32000

    # Agent outputs
    background: str = ""
    summary: str = ""
    detailed_description: str = ""
    abstract: str = ""
    figure_descriptions: str = ""

    # Non-LLM outputs
    cross_references: str = ""      # placeholder, user edits later
    ids_table: str = ""             # formatted from prior art

    # Cost accumulation
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_estimated_cost_usd: float = 0.0

    # Control
    step: str = ""
    error: str | None = None
```

### Agent Design

Each agent follows the same pattern:

```python
async def run_background(state: GraphState) -> dict:
    client = anthropic.AsyncAnthropic(api_key=state.api_key)
    system = load_prompt("background")
    user_message = build_user_message(state)  # agent-specific assembly
    response = await client.messages.create(
        model=state.default_model,
        max_tokens=state.max_tokens,
        system=system,
        messages=[{"role": "user", "content": user_message}],
        timeout=300.0,
    )
    cost = estimate_cost(state.default_model, response.usage.input_tokens, response.usage.output_tokens)
    return {
        "background": response.content[0].text,
        "total_input_tokens": state.total_input_tokens + response.usage.input_tokens,
        "total_output_tokens": state.total_output_tokens + response.usage.output_tokens,
        "total_estimated_cost_usd": state.total_estimated_cost_usd + cost,
        "step": "background",
    }
```

**Token optimization:** Each agent's system prompt includes: "The following sections have already been written for this application. Do not repeat their content." Followed by the prior sections' text. This keeps later agents focused and reduces redundancy.

**Agent inputs (what each agent sees):**

| Agent | Upstream Artifacts | Prior Agent Outputs |
|-------|-------------------|---------------------|
| background | invention narrative, feasibility stage 1, prior art context | (none — runs first) |
| summary | invention narrative, claims text | background |
| detailed_description | invention narrative, feasibility stages 5-6, spec language, claims text | background, summary |
| abstract | claims text | background, summary, detailed_description |
| figures | claims text | detailed_description |

### Formatter

**USPTO paragraph numbering:**
- Each paragraph in background, summary, detailed_description, abstract, and figure_descriptions gets sequential numbering: [0001], [0002], etc.
- Numbering is continuous across sections (background starts at [0001], summary continues where background left off)
- Claims section uses standard claim numbering (1., 2., etc.) — not paragraph numbers
- Cross-references and IDS are unnumbered

**IDS table formatting:**
- Takes prior art results array
- Outputs a formatted table with columns: Ref #, Patent/Pub Number, Date, Inventor/Applicant, Title
- No LLM call — pure data formatting from existing prior art search results

### Exporter

**DOCX export (python-docx):**
- Title page: invention title + "Patent Application" + generated date + UPL disclaimer
- Table of contents (section headings)
- Each section as a headed chapter with paragraph-numbered body text
- Claims formatted per standard (numbered, indented dependents)
- IDS as a formatted table
- Footer: "Generated by PatentForge — Not Legal Advice"

**Markdown export:**
- Standard markdown with `# Section Name` headers
- Paragraph numbers inline: `[0001] First paragraph text...`
- Claims as numbered list
- IDS as markdown table

### Auth, Cost, Error Handling

All identical to claim-drafter patterns:
- `X-Internal-Secret` header, disabled when env var unset (dev mode)
- `MODEL_PRICING` dict with Haiku/Sonnet/Opus rates, per-agent accumulation
- Prompt SHA256 hashes in `/health` response
- `state.error` set on exception, checked after each node
- API key resolved from env var first, request body as fallback
- API key scrubbed from state in finalize node

---

## 4. Backend Integration

### Location

```
backend/src/application/
├── application.module.ts
├── application.controller.ts
├── application.service.ts
└── dto/
    └── update-section.dto.ts
```

### Module Registration

Add `ApplicationModule` to `app.module.ts` imports.

### Environment

Add to backend environment:
```
APPLICATION_GENERATOR_URL=http://localhost:3003  (dev)
APPLICATION_GENERATOR_URL=http://application-generator:3003  (docker)
```

### Controller Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/projects/:id/application/generate` | Start generation |
| GET | `/projects/:id/application` | Get latest application |
| GET | `/projects/:id/application/:version` | Get specific version |
| PUT | `/projects/:id/application/sections/:name` | Update single section |
| GET | `/projects/:id/application/export/docx` | Export Word document |
| GET | `/projects/:id/application/export/markdown` | Export Markdown |

### Service Behavior

**onModuleInit():**
- Find all PatentApplication records with status='RUNNING', set to 'ERROR' with message "Interrupted by server restart" (crash cleanup, same as claim-draft)

**startGeneration(projectId):**
1. Validate project exists
2. Validate claims exist (at least one ClaimDraft with status='COMPLETE')
3. Check cost cap (same pattern as claim-draft)
4. Collect upstream artifacts:
   - Invention narrative (from InventionInput)
   - Feasibility stage 1 output (technical restatement)
   - Feasibility stages 5-6 outputs (IP strategy, report)
   - Prior art results (top 20, with cached claims text)
   - Claims text (formatted from latest ClaimDraft)
   - Spec language (from ClaimDraft.specLanguage)
5. Determine version number (max existing version + 1, or 1)
6. Create PatentApplication record with status='RUNNING'
7. Fire async IIFE: `callApplicationGenerator()`
8. Return immediately with the new record
9. **finally block** guarantees status never stuck as RUNNING

**callApplicationGenerator():**
- POST to `APPLICATION_GENERATOR_URL/generate/sync`
- `http.request` with 900s timeout (15 minutes, same as claim-drafter)
- Inject API key server-side (from AppSettings, decrypted)
- On success: update PatentApplication with all section fields, status='COMPLETE', cost
- On error: update status='ERROR' with error message

**updateSection(projectId, sectionName, text):**
- Validates section name is one of: title, crossReferences, background, summary, detailedDescription, claims, figureDescriptions, abstract, idsTable
- Updates single column on latest PatentApplication record
- Returns updated record

**getDocxBuffer(projectId):**
- Calls Python service POST `/export/docx` with all section data
- Returns DOCX bytes with Content-Type and Content-Disposition headers

**getMarkdown(projectId):**
- Calls Python service POST `/export/markdown` with all section data
- Returns Markdown text

### Database

Uses existing `PatentApplication` model from Prisma schema. No migration needed.

Current schema fields: id, projectId, version, status, title, abstract, background, summary, detailedDescription, claims, figureDescriptions, createdAt.

**Fields to add to Prisma schema:**
- `crossReferences String?` — user-editable cross-references section
- `idsTable String?` — formatted Information Disclosure Statement
- `estimatedCostUsd Float?` — generation cost tracking
- `completedAt DateTime?` — when generation finished
- `errorMessage String?` — error details if failed

This is a minor schema addition (5 nullable columns), not a structural migration.

---

## 5. Frontend

### ApplicationTab Component

**Location:** `frontend/src/components/ApplicationTab.tsx`

**Props:**
```typescript
interface ApplicationTabProps {
  projectId: string;
  hasClaims: boolean;
}
```

**States:**
```typescript
const [application, setApplication] = useState<PatentApplication | null>(null);
const [generating, setGenerating] = useState(false);
const [editingSection, setEditingSection] = useState<string | null>(null);
const [editText, setEditText] = useState('');
const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
```

**Behavior:**
- If `!hasClaims`: Alert — "Draft claims before generating an application"
- If no application: "Generate Application" button
- On Generate click: UPL disclaimer modal (one-time per component mount). On accept: `api.application.start(projectId)`, `setGenerating(true)`
- While generating: poll `api.application.getLatest(projectId)` every 3s. Show step progress as backend updates status.
- On complete: display sections

**Layout:**
- Left panel: section name list (clickable, active highlighted with `bg-blue-900 border-blue-700`)
- Right panel: selected section content with [NNNN] paragraph numbers. Click to edit (textarea). Save/Cancel buttons.
- Top toolbar: "Export Word" button, "Export Markdown" button, "Regenerate" button

**Section editing:**
- Click section content → textarea appears with raw text (no paragraph numbers in edit mode)
- Save → `api.application.updateSection(projectId, sectionName, text)`
- Cancel → revert to stored text
- Same in-place pattern as ClaimsTab claim editing

### API Layer Additions

Add to `frontend/src/api.ts`:

```typescript
application: {
  start: (projectId: string) => req<PatentApplication>('POST', `/projects/${projectId}/application/generate`),
  getLatest: (projectId: string) => req<PatentApplication>('GET', `/projects/${projectId}/application`),
  getVersion: (projectId: string, version: number) => req<PatentApplication>('GET', `/projects/${projectId}/application/${version}`),
  updateSection: (projectId: string, name: string, text: string) => req<PatentApplication>('PUT', `/projects/${projectId}/application/sections/${name}`, { text }),
  exportDocx: (projectId: string) => fetch(`/api/projects/${projectId}/application/export/docx`).then(r => r.blob()),
  exportMarkdown: (projectId: string) => req<string>('GET', `/projects/${projectId}/application/export/markdown`),
},
```

### ProjectDetail.tsx Changes

- Import ApplicationTab
- Add `'application'` to ViewMode type
- Add "Application" button in sidebar after Compliance button (enabled when claims exist)
- Add ApplicationTab render block in main content area

---

## 6. Docker Compose

Add to `docker-compose.yml`:

```yaml
application-generator:
  build: ./services/application-generator
  environment:
    PORT: 3003
    HOST: "0.0.0.0"
    INTERNAL_SERVICE_SECRET: ${INTERNAL_SERVICE_SECRET:?Set INTERNAL_SERVICE_SECRET}
    ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
  restart: unless-stopped
```

Add to backend environment:
```yaml
APPLICATION_GENERATOR_URL: http://application-generator:3003
```

No external port exposed — only reachable by backend within Docker network.

---

## 7. Launcher Scripts

Update `PatentForge.ps1` and `PatentForge.bat` to start application-generator as the 6th service:

```
cd services/application-generator && pip install -e . && uvicorn src.server:app --host 0.0.0.0 --port 3003
```

Same pattern as claim-drafter and compliance-checker startup.

---

## 8. Tests

### Python Service Tests

**test_auth.py** — Internal secret auth
- Health endpoint always accessible (200)
- Dev mode (no secret set): /generate/sync accessible
- Production mode: 403 without header, 200 with correct header

**test_models.py** — Request/response validation
- Valid request accepted
- Missing required fields rejected
- Prior art items validated (max 20)
- Settings validated (model required)

**test_formatter.py** — USPTO formatting
- Paragraph numbering: sequential [0001] through sections
- Numbering continuity across sections
- Claims excluded from paragraph numbering
- IDS table formatting from prior art results
- Empty sections handled (no numbering applied)

**test_graph.py** — Pipeline with mocked LLM
- Full pipeline: all 5 agents called sequentially
- State passing: each agent sees prior outputs
- Error handling: agent failure sets state.error, pipeline stops
- Cost accumulation: totals across all agents
- API key scrubbed in finalize

**test_exporter.py** — Export output
- DOCX: correct sections, headings, paragraph numbers, disclaimer
- Markdown: correct headers, inline paragraph numbers, IDS table
- Empty sections omitted from export

### Backend Test

**application.spec.ts** — NestJS service
- startGeneration: creates record, validates claims exist
- startGeneration: rejects if no claims
- updateSection: updates single field
- onModuleInit: cleans stuck RUNNING records

### Frontend Test

**ApplicationTab.test.tsx**
- Renders "draft claims first" when hasClaims=false
- Renders generate button when no application exists
- Shows disclaimer modal on generate click
- Renders section navigation when application loaded
- Section click updates active section display

---

## 9. Version & Packaging

- All packages bump to 0.6.0: backend/package.json, frontend/package.json, services/claim-drafter/pyproject.toml, services/compliance-checker/pyproject.toml, services/application-generator/pyproject.toml
- CHANGELOG.md updated with v0.6.0 entry
- No breaking changes to existing endpoints or behavior

---

## 10. Revised Roadmap

| Version | Scope |
|---------|-------|
| **v0.6** | Patent application generator (this spec) |
| **v0.7** | Windows installer (Inno Setup + portable Node.js + embeddable Python, launcher, tray icon) |
| **v0.8** | Polish, testing, edge cases, first real user feedback |
| **v1.0** | Public release |
| **Post-v1.0** | Local LLM support, EFS-Web XML export, Office Action response drafting |

No backend rewrite. No runtime migration. Installer packages existing stack.

---

## 11. Out of Scope

- Native PDF export (users save-as-PDF from Word)
- EFS-Web XML export (v1.0)
- Compliance gate for generation (claims required, compliance optional)
- Automatic claim formatting changes (claims pulled as-is from ClaimDraft)
- Office Action response drafting (post-v1.0)
- Local LLM support (post-v1.0)
