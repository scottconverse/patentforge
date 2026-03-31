# PatentForge

**AI-powered patent landscape research tool for inventors.**

> **PatentForge is a research tool, not a legal service.** The author of this tool is not a lawyer. This tool does not provide legal advice. It helps inventors explore the patent landscape for their ideas using AI — the same way a book about patents helps you understand the process without replacing an attorney.
>
> By using PatentForge, you are running prompts on your own AI account and generating your own research output. The output is for your personal educational use. It is not a substitute for professional legal counsel.

PatentForge is a self-hosted web application that helps inventors organize their thinking about an invention before consulting a patent attorney. It uses Claude AI to structure a technical analysis, search for related patents, and highlight the questions a patent professional would explore — so you walk into that first meeting prepared, not cold.

## What PatentForge Does

- **Structured technical analysis** — 6-stage AI pipeline that restates your invention in patent terminology, searches for related prior art, identifies potential issues under patent law, and organizes findings into a readable report
- **Prior art discovery** — automated patent search via USPTO Open Data Portal with improved relevance scoring (stop-word filtering, title weighting), plus AI-powered web search for related patents, papers, and products
- **Patent claims viewer** — lazy-loads actual patent claims text from the USPTO Documents API when you click a prior art result (requires free ODP API key)
- **Cost transparency** — pre-run cost estimate with per-stage token tracking so you know what the AI processing will cost before you start
- **Resume from interruption** — pick up where you left off if a run stops mid-pipeline
- **Multiple export formats** — HTML, Word (.docx), and Markdown for sharing with your attorney or team
- **AI-assisted claim drafting** — 3-agent pipeline (Planner, Writer, Examiner) generates patent claim drafts informed by your feasibility analysis and prior art, with per-claim examiner review
- **Self-hosted** — runs on your machine; invention data stays local except for Anthropic API calls
- **Configurable** — choose your model (Sonnet, Opus, Haiku), set max tokens, adjust inter-stage delays

## Important Disclaimer

PatentForge is a **research and preparation tool**, not a legal service. It does not provide legal advice, patent opinions, or attorney services. The output is intended to help you prepare for a consultation with a registered patent attorney or patent agent — not to replace one. Patent law is complex, and decisions about whether to file a patent application should always be made with qualified legal counsel.

### Legal Guardrails Built Into the Software

- **First-run clickwrap** — on first launch, users must acknowledge that PatentForge provides research, not legal advice, before using the app
- **API key disclaimer** — the Settings page notes that users are connecting to their own Anthropic account and should review the provider's data policies
- **Export watermarks** — every generated report (HTML, Word, and on-screen) carries a persistent disclaimer stating the output is AI-generated research, not a legal opinion

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (recommended: 20 LTS)
- [Python](https://python.org/) 3.11+ (for claim drafting service)
- [Anthropic API key](https://console.anthropic.com/)

### Install and Run

```bash
git clone https://github.com/scottconverse/patentforge.git
cd patentforge

# Install all dependencies
cd backend && npm install && cd ..
cd services/feasibility && npm install && cd ../..
cd services/claim-drafter && pip install . && cd ../..
cd frontend && npm install && cd ..

# Set up the database (SQLite, zero config)
cd backend && npx prisma migrate deploy && npx prisma generate && cd ..
```

**On Windows** — double-click `PatentForge.bat` (builds and starts everything, opens browser).

**Manual start** (any OS) — run each in a separate terminal:
```bash
cd backend && npm run build && npm run start                         # port 3000
cd services/feasibility && npm run build && npm run start             # port 3001
cd services/claim-drafter && python -m uvicorn src.server:app --port 3002  # port 3002
cd frontend && npm run dev                                            # port 8080
```

Open http://localhost:8080, go to Settings, enter your Anthropic API key, and create your first project.

### Docker (alternative)

```bash
# Optionally set your API key (or configure later in the Settings UI)
export ANTHROPIC_API_KEY=your-key-here

docker compose up --build
```

Open http://localhost:8080. Uses PostgreSQL instead of SQLite.

## How It Works

PatentForge runs a 6-stage sequential analysis pipeline using the Anthropic Claude API:

| Stage | Name | What It Does |
|-------|------|-------------|
| 1 | Technical Intake & Restatement | Restates your invention in precise technical language |
| 2 | Prior Art Research | Searches for existing patents, papers, and products |
| 3 | Patentability Review | Identifies potential issues under 35 USC 101, 102, 103, and 112 |
| 4 | Deep Dive Analysis | Examines AI/ML and 3D printing aspects in detail |
| 5 | Strategy Notes | Summarizes filing considerations, cost factors, and open questions |
| 6 | Consolidated Report | Assembles all findings into a single structured document |

Each stage builds on the output of all previous stages. Stages 2, 3, and 4 use Anthropic's web search tool for grounded research.

**Note:** The output of this pipeline is structured research, not a legal opinion. It is designed to help you and your patent attorney have a more productive first conversation.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  NestJS Backend  │────▶│  Feasibility    │
│  (Vite, TW CSS) │     │  (Prisma, SQLite)│     │  Service (TS)   │
│  port 8080      │◀────│  port 3000       │◀────│  port 3001      │
└─────────────────┘ SSE └─────────────────┘ SSE └─────────────────┘
                                │                       │
                                │                       ▼
                                │                Anthropic Claude API
                                ▼
                        ┌─────────────────┐
                        │  Claim Drafter  │
                        │  (Python/       │
                        │   LangGraph)    │
                        │  port 3002      │
                        └─────────────────┘
```

- **Frontend** — React 18, TypeScript, Tailwind CSS, Vite
- **Backend** — NestJS, Prisma ORM, SQLite (dev) / PostgreSQL (Docker)
- **Feasibility Service** — Express, Anthropic SSE streaming, 6 prompt templates
- **Claim Drafter** — Python, FastAPI, LangGraph, 3-agent pipeline (Planner/Writer/Examiner)

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design.

## Configuration

All settings are configurable via the Settings page in the UI:

| Setting | Default | Description |
|---------|---------|-------------|
| Anthropic API Key | — | Required. Your Claude API key. Encrypted at rest (AES-256-GCM). |
| USPTO API Key | — | Optional. Free key from [data.uspto.gov](https://data.uspto.gov/myodp) for enhanced patent search and claims viewing. Encrypted at rest. |
| Default Model | — | Required. Choose Sonnet, Opus, or Haiku before running analysis. No silent fallback. |
| Research Model | — | Optional separate model for Stage 2 (e.g., Haiku for cost savings) |
| Max Tokens | 32,000 | Maximum tokens per stage response |
| Inter-Stage Delay | 5 seconds | Pause between stages for rate limit protection |
| Cost Cap (USD) | 5.00 | Enforced server-side. Blocks new runs when cumulative project cost exceeds this amount. Mid-pipeline cancellation when a stage pushes cost over the cap. Set to 0 to disable. |
| Export Path | Desktop | Folder for saved reports. Must be within your home directory. |

### Authentication (Optional)

For network deployments, set the `PATENTFORGE_TOKEN` environment variable to require Bearer token auth on all API requests. When not set, auth is disabled (single-user local mode).

### Internal Service Security

The feasibility service (port 3001) and claim-drafter service (port 3002) are internal-only — the frontend communicates through the NestJS backend, which proxies SSE streams. Set `INTERNAL_SERVICE_SECRET` to require a shared secret header on all internal service calls. In Docker, this is configured automatically. In local dev, it's optional.

## Roadmap

- [x] **v0.1** — 6-stage AI analysis pipeline with streaming
- [x] **v0.2** — Prior art search, cost tracking, Word export, resume from interruption
- [x] **v0.3.0** — USPTO patent detail enrichment, individual stage re-run, CSV export
- [x] **v0.3.1** — USPTO Open Data Portal integration (replaces deprecated PatentsView API)
- [x] **v0.3.2** — Lazy-load patent claims from USPTO Documents API
- [x] **v0.3.3** — Playwright E2E tests, DOCX parser improvements, type safety, CORS hardening
- [x] **v0.3.4** — Scoring improvements, API key encryption, prompt integrity, CI pipeline, auth skeleton
- [x] **v0.4.0** — AI-assisted claim drafting (Python + LangGraph, 3-agent pipeline)
- [ ] **v0.5** — Compliance review tooling
- [ ] **v0.6** — Full application document assembly

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

## License

**Code** (backend, frontend, services): [MIT](LICENSE)

**Prompt content** (`services/feasibility/src/prompts/`): [CC BY-SA 4.0](LICENSE-PROMPTS)

See [LEGAL_NOTICE.md](LEGAL_NOTICE.md) for important information about this tool's limitations and your responsibilities.
