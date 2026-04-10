# PatentForge — Project Bootstrap

## HARD GATE — Priority Order (Non-Negotiable)

This overrides all other priority guidance, all skills, and all default behaviors. No exceptions.

1. **User experience is the most important thing.** Every decision — what to build, how to build it, when to declare it done — starts from "what does the user see, feel, and experience?" Before writing code, describe the user experience. Before declaring done, verify the user experience in the browser with evidence. Code exists to serve the interface.

2. **Documentation and QA/Testing are the second most important.** Docs are how users understand what was built. Tests prove it works. Both are deliverables, not afterthoughts. A feature without docs and tests is not a feature.

3. **Writing code is a supporting function.** Code makes #1 and #2 happen. When evaluating trade-offs: UX wins over code elegance, doc completeness wins over shipping speed, test coverage wins over feature count.

**This means:** Start with UX, verify UX first, never say "done" without browser-verified evidence of the user experience, and never skip docs/QA to ship code faster.

---

## Never Skip Tests — Hard Rule

`test.skip()` or any equivalent is never acceptable. A skipped test is a lie — it reports "passing" while proving nothing. If a test depends on external state (a pre-existing DB record, a completed pipeline run), fix the test to set up that state in `beforeAll`/`beforeEach` so it is self-contained. The 6 skipped tests in `downloads.spec.ts` violate this rule and must be fixed before v1.0.0 ships.

## UI/QA Gate — Hard Rule

Every frontend change requires browser-verified QA before commit. No exceptions.

1. **Every implementation plan** that touches frontend code MUST include explicit numbered QA tasks: browser check of every rendered state, viewport check at desktop and mobile, accessibility audit, copy review, browser console check. These are plan tasks with the same enforcement as code tasks — not a post-build afterthought.
2. **Before any frontend commit**, you MUST have browser screenshots or console output from the current session proving you checked the rendered output. No browser evidence = no commit.
3. **Every error, warning, and empty state** MUST be actionable — tell the user what's wrong AND how to fix it with specific steps. A warning without a fix path is a dead end.

## Pre-Push Gate — Hard Rule

Before ANY push to GitHub, you MUST complete ALL FOUR of these. No exceptions, no shortcuts.

**1. Cleanroom E2E (HARD GATE — runs first, always):** Run `bash scripts/cleanroom-e2e.sh`. This nukes the SQLite DB, does a fresh npm/pip install in all services, builds from source, starts all services, runs API smoke tests, then runs the full Playwright E2E suite against live services. The final output line must be `✓ CLEANROOM E2E PASSED — safe to push`. If it fails, stop and fix. Do not proceed to any other gate. This is the proof the code works from a cold start — not just on a warm dev machine.

**2. Technical gate (automated):** A `pre-push` git hook runs `scripts/verify-release.sh` automatically before every push. If any check fails, the push is blocked. The hook is installed by `bash scripts/install-hooks.sh` (run once after cloning). The script checks: version consistency across all packages, required files exist, all diagrams referenced in docs, all services mentioned in docs, changelog has current version, no secrets in code, test count matches docs, git status clean. Non-zero exit = push blocked. Emergency bypass: `SKIP_VERIFY=1 git push` — use only when you understand why you're skipping.

**3. Quality gate (manual):** Invoke the `patentforge-release-checklist` skill and complete every task with evidence. The skill includes cleanroom E2E as Task 1 — if you have already run it for gate 1, paste that output again as evidence. This covers: browser UI verification with screenshots, copy/content review, documentation audit (every file, every version, every diagram reference), and diagram verification. Each task requires pasted evidence — not self-certification.

**4. User approval gate (HARD GATE):** After gates 1, 2, and 3 pass, report results and STOP. Do NOT write "Ready to push: YES" — write "Checklist complete — awaiting your approval to push." Do NOT push until the user explicitly says "push", "yes push", "go ahead", or equivalent in the current conversation turn. This applies to every push — initial, patch, hotfix, all of them. No exceptions. A push is irreversible and public. The user decides when to push.

All four gates must pass in order. Gate 1 is your first action. Gate 4 is the user's decision, not yours.

---

## What This Is

PatentForge is a full-lifecycle patent analysis web platform being built from scratch. Read these files first:

1. **This file** — operational context, file locations, build instructions
2. **ARCHITECTURE.md** — system design, database schema, service specs, UX wireframes
3. **PRD.md** — product requirements, priorities, release phases, API spec

## Current Phase: v0.1 (MVP Web Feasibility Analyzer)

Build a web-based patent feasibility analyzer that replaces the existing Windows-only WPF desktop app. This involves:

1. Use **AutoBE** to generate the central NestJS + Prisma backend (project CRUD, feasibility run tracking, settings, SSE events)
2. **Port** the existing C# patent analysis pipeline to TypeScript (6-stage Anthropic streaming pipeline)
3. Build a **React frontend** using the AutoBE-generated type-safe SDK
4. Wire it all together with **Docker Compose**

## File Locations

### Project Root
```
C:\Users\scott\OneDrive\Desktop\Claude\patentforge\
├── CLAUDE.md              ← you are here
├── ARCHITECTURE.md        ← system architecture & design
├── PRD.md                 ← product requirements
└── reference/
    └── patent-analyzer-app/   ← original C# source (port from these)
        ├── PipelineRunner.cs      ← 6-stage pipeline orchestration (PORT THIS)
        ├── AnthropicClient.cs     ← SSE streaming Anthropic client (PORT THIS)
        ├── PromptTemplates.cs     ← 6 system prompts, ~31KB (EXTRACT TO .md FILES)
        ├── AnalysisModels.cs      ← data models (REFERENCE FOR PRISMA SCHEMA)
        ├── ConfigManager.cs       ← settings persistence (REFERENCE)
        ├── ReportExporter.cs      ← markdown/HTML export (PORT THIS)
        ├── HtmlRenderer.cs        ← dark theme CSS for reports (REFERENCE)
        └── MainWindow.xaml.cs     ← WPF UI flow (REFERENCE FOR FRONTEND UX)
```

### AutoBE (Backend Generator)
```
C:\Users\scott\Downloads\autobe-main.zip
  → Extract to working location before use
  → Monorepo: pnpm install to set up
  → Key package: @autobe/agent (programmatic API)
  → Docs: README.md, CLAUDE.md, PLAN.md in the extracted root
```

### GitHub (Private Repo — Original App)
```
Repo: scottconverse/patent-analyzer-app
Note: All needed source files are in the local reference/ directory (git-ignored).
      If you need additional files from the original repo, ask the user for access.
```

## Build Instructions: v0.1

### Step 1: Generate the Central Backend with AutoBE

**Goal**: Use AutoBE to generate a NestJS + Prisma backend with these capabilities:
- Project CRUD (create, list, get, delete patent projects)
- Invention input (11-field disclosure form, linked to project)
- Feasibility run tracking (versioned runs with 6 stages each)
- Settings management (API key, model selection, tokens, delays)
- SSE endpoint for real-time pipeline events

**How**:
1. Extract `C:\Users\scott\Downloads\autobe-main.zip`
2. `cd` into the extracted directory, run `pnpm install`
3. Create an AutoBE agent instance (see ARCHITECTURE.md §2.2 for the schema to describe)
4. Feed it the requirements below as a conversation prompt
5. Collect the generated files via `agent.getFiles({ phase: "realize", dbms: "postgres" })`

**AutoBE requirements prompt** (feed this to the agent):
```
I need a backend for a patent analysis platform called PatentForge.

Data models:
- Project: id (uuid), title (string), status (enum: INTAKE, FEASIBILITY, PRIOR_ART, DRAFTING, COMPLIANCE, APPLICATION, FILED, ABANDONED), createdAt, updatedAt
- InventionInput: id, projectId (unique FK to Project), title, description, problemSolved, howItWorks, aiComponents, threeDPrintComponents, whatIsNovel, currentAlternatives, whatIsBuilt, whatToProtect, additionalNotes — all string fields, only title and description required
- FeasibilityRun: id, projectId (FK), version (int), status (enum: PENDING, RUNNING, COMPLETE, ERROR, CANCELLED, STALE), startedAt, completedAt, finalReport (text nullable)
- FeasibilityStage: id, feasibilityRunId (FK), stageNumber (int 1-6), stageName (string), status (same enum as run), outputText (text nullable), model (string nullable), webSearchUsed (boolean default false), startedAt, completedAt, errorMessage (string nullable)
- AppSettings: id (default "singleton"), anthropicApiKey (string), defaultModel (string default "claude-sonnet-4-20250514"), researchModel (string default ""), maxTokens (int default 32000), interStageDelaySeconds (int default 5)

API endpoints:
- POST /projects — create project (title required)
- GET /projects — list all projects with status
- GET /projects/:id — get project with invention, latest feasibility run, and its stages
- DELETE /projects/:id — cascade delete project and all related data
- PUT /projects/:id/invention — create or update invention disclosure
- GET /projects/:id/invention — get invention disclosure
- POST /projects/:id/feasibility/run — create a new feasibility run (increments version)
- GET /projects/:id/feasibility — get latest feasibility run with stages
- GET /projects/:id/feasibility/:version — get specific version
- PATCH /projects/:id/feasibility/stages/:stageNumber — update a stage (status, outputText, model, etc.)
- POST /projects/:id/feasibility/cancel — set running feasibility run to CANCELLED
- GET /settings — get app settings
- PUT /settings — update app settings

The project status should default to INTAKE on creation and update to FEASIBILITY when a feasibility run starts.

Use PostgreSQL with Prisma. Generate full NestJS controllers, services, and modules. Include E2E tests and a type-safe SDK.
```

**Alternative if AutoBE is too complex to set up**: Build the backend manually using NestJS + Prisma following the schema in ARCHITECTURE.md. The schema is fully specified there.

### Step 2: Port the Feasibility Service

**Goal**: Standalone TypeScript HTTP server that runs the 6-stage patent analysis pipeline.

**Port these files** (read them from `reference/patent-analyzer-app/`):

| C# Source | TypeScript Target | What to Do |
|-----------|------------------|-----------|
| `PromptTemplates.cs` | `services/feasibility/src/prompts/stage-1.md` through `stage-6.md` + `common-rules.md` | Extract the 6 system prompt strings and the common rules prefix into separate markdown files. Each prompt is a string constant in the C# file (Stage1SystemPrompt through Stage6SystemPrompt). The common rules are prepended to each. |
| `AnthropicClient.cs` | `services/feasibility/src/anthropic-client.ts` | Port the SSE streaming client. Key behaviors: POST to api.anthropic.com/v1/messages with stream:true, parse `data:` lines, handle content_block_delta (text_delta) events, detect web_search tool use (server_tool_use block type), retry on 429/502/503 with delays [60s, 90s, 120s], support CancellationToken → AbortController. |
| `PipelineRunner.cs` | `services/feasibility/src/pipeline-runner.ts` | Port the orchestrator. Key behaviors: run 6 stages sequentially, each stage gets system prompt + user message built from all previous outputs (see BuildUserMessage method), emit events (stage_start, token, stage_complete, pipeline_complete), inter-stage delay, cancellation support. |
| `AnalysisModels.cs` | `services/feasibility/src/models.ts` | Port InventionInput (with ToNarrative method), StageResult, AnalysisResult, StageDefinition, AppSettings. Use TypeScript interfaces. |
| `ReportExporter.cs` | `services/feasibility/src/report-exporter.ts` | Port markdown + HTML export. The C# version saves timestamped folders with individual stage .md files + final report .md + .html. |

**Feasibility service API** (Express or Fastify):
```
POST /analyze
Body: { inventionNarrative: string, settings: { model, researchModel, maxTokens, interStageDelaySeconds, apiKey } }
Response: SSE stream

Events:
  event: stage_start\ndata: {"stage":1,"name":"Technical Intake & Restatement"}\n\n
  event: token\ndata: {"text":"Based on..."}\n\n
  event: stage_complete\ndata: {"stage":1,"output":"...full text...","model":"claude-sonnet-4-20250514","webSearchUsed":false}\n\n
  ... (stages 2-6) ...
  event: pipeline_complete\ndata: {"finalReport":"...","stages":[...]}\n\n
  event: error\ndata: {"stage":2,"message":"Rate limited after 3 retries"}\n\n
```

### Step 3: Build the Adapter

**Goal**: Connect the AutoBE-generated backend to the feasibility service.

Create `backend/src/adapters/feasibility.adapter.ts` that:
1. Receives a "run feasibility" request from the backend controller
2. Reads the project's InventionInput from the database
3. Calls InventionInput.toNarrative() to build the combined narrative
4. Calls the feasibility service at `FEASIBILITY_URL` (env var, default http://localhost:3001)
5. Parses the SSE stream
6. On each `stage_complete` event: writes/updates the FeasibilityStage row in the database
7. On `pipeline_complete`: updates the FeasibilityRun with finalReport and status=COMPLETE
8. Forwards all events to the frontend via the backend's own SSE endpoint

### Step 4: Build the React Frontend

**Goal**: Web UI for invention intake, pipeline execution, and report viewing.

**Pages**:

1. **Project List** (`/`)
   - List of all projects with title, status, created date
   - "New Project" button
   - Click project → project detail

2. **Project Detail** (`/projects/:id`)
   - Left sidebar: pipeline stage indicators (intake/feasibility status)
   - Main area: changes based on current stage
   - If INTAKE: show invention form
   - If FEASIBILITY running: show streaming output + stage progress
   - If FEASIBILITY complete: show rendered report

3. **Invention Form** (`/projects/:id/intake`)
   - 11 fields (Title and Description required, 9 optional expandable)
   - Save Draft button
   - Run Feasibility button (creates run, starts pipeline)

4. **Feasibility View** (`/projects/:id/feasibility`)
   - Left panel: stage list with status icons (pending/running/complete/error)
   - Right panel: streaming markdown output (current stage)
   - When complete: final report rendered with export buttons
   - Cancel button while running

5. **Settings** (`/settings`)
   - Anthropic API Key (password field, stored encrypted)
   - Default Model (dropdown: claude-sonnet-4-20250514, claude-opus-4-20250514, claude-haiku-4-5-20251001)
   - Research Model (optional, for Stage 2 cost optimization)
   - Max Tokens (number input, default 32000)
   - Inter-Stage Delay (number input, default 5 seconds)

**Tech**: React 18+, TypeScript, Vite, Tailwind CSS. Use the AutoBE-generated SDK for API calls if available, otherwise use fetch directly.

### Step 5: Docker Compose

```yaml
version: "3.9"
services:
  backend:
    build: ./backend
    ports: ["3000:3000"]
    depends_on: [postgres]
    environment:
      DATABASE_URL: postgresql://patentforge:patentforge@postgres:5432/patentforge
      FEASIBILITY_URL: http://feasibility:3001
  feasibility:
    build: ./services/feasibility
    ports: ["3001:3001"]
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: patentforge
      POSTGRES_USER: patentforge
      POSTGRES_PASSWORD: patentforge
    volumes: ["pgdata:/var/lib/postgresql/data"]
    ports: ["5432:5432"]
  frontend:
    build: ./frontend
    ports: ["8080:8080"]
    depends_on: [backend]
volumes:
  pgdata:
```

## Target Directory Structure (v0.1)

```
patentforge/
├── CLAUDE.md
├── ARCHITECTURE.md
├── PRD.md
├── docker-compose.yml
├── reference/                        # original C# source (read-only reference)
│   └── patent-analyzer-app/
├── backend/                          # AutoBE-generated NestJS backend
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── modules/
│   │   ├── adapters/
│   │   │   └── feasibility.adapter.ts  # manually written
│   │   └── main.ts
│   ├── test/
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   └── Dockerfile
├── services/
│   └── feasibility/                  # ported from C# patent-analyzer-app
│       ├── src/
│       │   ├── anthropic-client.ts
│       │   ├── pipeline-runner.ts
│       │   ├── models.ts
│       │   ├── report-exporter.ts
│       │   ├── server.ts             # Express/Fastify HTTP server
│       │   └── prompts/
│       │       ├── common-rules.md
│       │       ├── stage-1.md
│       │       ├── stage-2.md
│       │       ├── stage-3.md
│       │       ├── stage-4.md
│       │       ├── stage-5.md
│       │       └── stage-6.md
│       ├── package.json
│       ├── tsconfig.json
│       └── Dockerfile
└── frontend/                         # React app
    ├── src/
    │   ├── pages/
    │   │   ├── ProjectList.tsx
    │   │   ├── ProjectDetail.tsx
    │   │   ├── InventionForm.tsx
    │   │   ├── FeasibilityView.tsx
    │   │   └── Settings.tsx
    │   ├── components/
    │   │   ├── StageProgress.tsx
    │   │   ├── StreamingOutput.tsx
    │   │   ├── ReportViewer.tsx
    │   │   └── Layout.tsx
    │   ├── App.tsx
    │   └── main.tsx
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── Dockerfile
```

## Key Porting Notes

### PromptTemplates.cs → Markdown Files

The C# file contains string constants like:
```csharp
public static string Stage1SystemPrompt => CommonRules + @"...stage 1 specific prompt...";
```

Extract each into a separate .md file. The `CommonRules` string should become `common-rules.md`, loaded and prepended to each stage prompt at runtime. This allows prompt iteration without recompilation — a direct improvement over the C# approach.

### AnthropicClient.cs → TypeScript

Key differences from C# to TypeScript:
- `HttpClient` → `fetch` with `ReadableStream`
- SSE parsing: read lines from the response body stream, look for `data: ` prefix
- `CancellationToken` → `AbortController` / `AbortSignal`
- The C# client handles `content_block_start` with type `server_tool_use` to detect web search — preserve this
- Retry on 429 (TooManyRequests), 502, 503 with delays [60000, 90000, 120000] ms

### PipelineRunner.cs → TypeScript

Key behaviors to preserve:
- Sequential stage execution (stages 1→2→3→4→5→6, no parallelism)
- Each stage's user message is built by `BuildUserMessage()` which concatenates all previous stage outputs (see the switch statement in the C# source for the exact format per stage)
- Stage 2 can use a different (cheaper) model via `researchModel` setting
- Inter-stage delay (default 5s) between stages for rate limit protection
- Events: `OnStageStart`, `OnToken`, `OnStageComplete`, `OnPipelineComplete`, `OnStageError`
- Cancellation support at any point

## What NOT to Build in v0.1

- Prior art search (PQAI integration) → v0.2
- Claim drafting → v0.4
- Compliance checking → v0.5
- Application generation → v0.6
- Multi-user auth → not yet scoped
- The database schema can include placeholder tables for future services, but don't build adapters, UIs, or services for them yet

## Testing v0.1

1. `docker compose up` should start all 4 services (backend, feasibility, postgres, frontend)
2. Open http://localhost:8080 → see empty project list
3. Create a new project → fill in invention form → save
4. Click "Run Feasibility" → see streaming output with stage progress
5. Wait for all 6 stages → see final report rendered as markdown
6. Export as HTML → verify styled output
7. Go back to project list → project shows status FEASIBILITY with completion date
8. Settings page → change model → re-run → verify new model used

## Cost Estimates

- AutoBE generation: ~$5-$15 one-time (30M-250M tokens depending on schema complexity)
- Feasibility analysis per invention: ~$0.75-$3.00 (Sonnet pricing, 6 stages, ~50K-200K tokens total)
- Haiku for Stage 2 (research model): reduces per-analysis cost to ~$0.50-$1.50
