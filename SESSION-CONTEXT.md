# PatentForge — Session Context

> Feed this to a fresh Claude session to pick up where we left off.

## Project State: v0.6 Application Generator — Built, Tested, Not Live-Tested

PatentForge is a patent analysis web platform at v0.5.2 (stable) with v0.6 in progress.

### Architecture (7 services)
```
postgres ──► backend (NestJS, port 3000)
               ├──► feasibility (TypeScript, port 3001) — 6-stage Anthropic pipeline
               ├──► claim-drafter (Python/FastAPI/LangGraph, port 3002)
               ├──► compliance-checker (Python/FastAPI, port 3004)
               └──► application-generator (Python/FastAPI/LangGraph, port 3003) ← NEW v0.6
frontend (React/Vite/Tailwind, port 8080)
```

### What v0.6 Added (on local git, not yet on github.com)
- `services/application-generator/` — Python FastAPI + LangGraph service
  - 5 agents: background, summary, detailed_description, abstract, figures
  - USPTO paragraph numbering, claims formatting
  - Word/PDF/Markdown export (python-docx, WeasyPrint)
  - 26 tests passing (formatter, graph pipeline, exporter)
- `backend/src/application/` — NestJS controller/service/module
- `frontend/src/components/ApplicationTab.tsx` — section nav, inline editing, export
- `docker-compose.yml` updated with `application-generator` service
- `v0.6-SCOPE.md` — full spec + migration roadmap

### Key Files to Read First
1. `CLAUDE.md` — project bootstrap, current phase, workflow rules
2. `v0.6-SCOPE.md` — v0.6 spec + migration roadmap (TS→Python, PostgreSQL→SQLite, standalone installer)
3. `ARCHITECTURE.md` — system design, database schema, UX wireframes
4. `PRD.md` — product requirements, release phases

### Critical Decisions Already Made
- **All new services are Python** (not TypeScript) — packaging for standalone .exe installer
- **v0.7**: Add SQLite mode to NestJS backend (DATABASE_PROVIDER=sqlite)
- **v0.8**: Port NestJS backend + feasibility service to Python (FastAPI)
- **v0.9**: PyInstaller standalone Windows installer (double-click, no Docker)
- **PostgreSQL stays for Docker/cloud**; SQLite for desktop standalone mode

### Python Service Patterns (follow exactly)
- FastAPI + Pydantic + LangGraph + Anthropic SDK
- `X-Internal-Secret` header auth (disabled in dev)
- `/health` endpoint with prompt hash verification
- SSE via `sse-starlette` + sync endpoint variant
- Cost tracking: `total_input_tokens`, `total_output_tokens`, `total_estimated_cost_usd`
- Dockerfile: `python:3.12-slim`, `pip install .`, uvicorn CMD
- Backend calls sync endpoint via `http.request` with long timeout, fire-and-forget pattern

### Backend Integration Pattern (follow exactly)
- NestJS module: controller.ts, service.ts, module.ts, dto/
- Service creates DB record with RUNNING status
- Fires async IIFE to call Python service (fire-and-forget)
- Finally block guarantees status never left as RUNNING
- OnModuleInit cleans up stuck RUNNING records from crashes

### What's Next (in priority order)
1. **Live-test v0.6** with real Anthropic API calls end-to-end
2. **v0.7 — SQLite mode** (small change, big impact for packaging)
3. **v0.8 — Port backend to Python** (big rewrite)
4. **v0.9 — Standalone installer** (PyInstaller + NSIS/Inno Setup)

### Workflow Rules
- Commit to **local git** on feature branch, report to user
- **Never push to github.com** without explicit user approval
- User decides when code goes public
- Follow existing patterns exactly — don't invent new conventions
