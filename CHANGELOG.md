# Changelog

All notable changes to PatentForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-03-31

### Added
- **First-run disclaimer modal** — unskippable clickwrap agreement on first launch acknowledging the tool provides research, not legal advice
- **API key entry disclaimer** — Settings page notes that the user is connecting to their own Anthropic account and should review the provider's data privacy policies
- **Export watermarks** — all generated reports (HTML, Word, on-screen) include a persistent legal disclaimer at the bottom stating the output is AI-generated research, not legal advice

## [0.2.0] - 2026-03-31

### Added
- **Prior art search** — PatentsView API integration with Haiku-powered query extraction, keyword scoring, and relevance bar UI
- **Prior art panel** — SSE-streamed patent cards with Google Patents links and abstract snippets
- **Prior art context injection** — Stage 2 waits up to 45s for prior art results before pipeline start
- **Dynamic pricing** — LiteLLM JSON pricing (1-hour cache with mutable fallback updated on each fetch)
- **Cost confirmation modal** — three-row breakdown showing token cost, web search cost (~15 searches at $0.01), and total; LiteLLM attribution; stageCount prop for partial runs
- **Resume from interrupted stage** — reuses existing run, only runs remaining stages with partial cost estimate
- **Stale RUNNING run detection** — on page load, patches stuck runs to ERROR status, shows partial results with Resume button
- **SSE keepalive heartbeat** — 20-second interval in feasibility service prevents idle connection drops
- **Stream-ended-without-complete detection** — shows error message instead of infinite spinner
- **Token streaming throttle** — 250ms setTimeout batching prevents browser freeze during streaming
- **DOCX table rendering** — proper Word tables with borders and shaded headers (not raw pipe-delimited text)
- **Word download** — backend returns binary buffer via GET endpoint, frontend triggers blob download
- **Stage output viewer** — plain text `<pre>` rendering (no markdown rendering avoids freeze on large outputs)
- **Stage download button** — saves individual stage output as .md to Downloads folder
- **Total API cost field** — shown below stage list in sidebar

### Changed
- Download buttons now trigger browser Downloads folder (cross-platform) instead of Windows-specific server-side save
- "Starting analysis..." placeholder now shows stage number and large-input hint
- PatentForge.ps1 launcher updated to build backend + feasibility before starting (picks up source changes)

### Removed
- "Download Markdown" button (not useful to end users compared to HTML and Word exports)

## [0.1.0] - 2026-03-30

### Added
- **6-stage AI patent research pipeline** — sequential analysis with Anthropic Claude (configurable model)
- **Invention intake form** — 11-field disclosure form (title and description required, 9 optional fields)
- **Real-time streaming** — SSE token streaming from LLM to browser with stage progress indicators
- **Report viewer** — rendered markdown final report with export capabilities
- **HTML export** — styled, printable feasibility report with dark theme
- **Stage 2 web search** — Anthropic web search tool integration for prior art research (max 20 searches)
- **Stage 3 & 4 web search** — patentability review and deep dive with web search (max 5 and 10 searches)
- **Rate limit handling** — automatic retry with escalating delays (60s/90s/120s) on 429/502/503
- **Settings page** — configure API key, model selection, max tokens, inter-stage delay
- **Project management** — create, list, view, and delete patent projects
- **Pipeline cancellation** — cancel running analysis at any point
- **SQLite database** — zero-dependency local development with Prisma ORM
- **Three-service architecture** — NestJS backend (port 3000), Express feasibility service (port 3001), Vite React frontend (port 8080)
- **Docker Compose** — single-command deployment for all services plus PostgreSQL
