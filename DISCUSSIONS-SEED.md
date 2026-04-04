# GitHub Discussions — Seed Posts

These are the initial posts to create when GitHub Discussions is enabled on the PatentForge repo.

---

## Category: Announcements (pin this post)

### Title: Welcome to PatentForge — What It Is and What's Coming

**Body:**

Hey everyone! PatentForge is now open source.

**What it does:** PatentForge is a self-hosted web app that helps inventors explore the patent landscape for their ideas using AI. You describe your invention, and it runs a 6-stage analysis — restating your idea in technical language, searching for related patents, mapping it against patent law requirements, and assembling everything into a structured report you can take to a patent attorney.

**What it doesn't do:** This is a research tool, not a legal service. The author isn't a lawyer, the AI isn't a lawyer, and none of the output is legal advice. It's designed to help you prepare for a meeting with a real patent attorney — not replace one.

**Current status (v0.8.0):**
- **Feasibility analysis** — 6-stage AI pipeline: technical intake, prior art research, patentability review, deep-dive analysis, strategy notes, consolidated report
- **Prior art search** — USPTO Open Data Portal integration with relevance scoring (stop-word filtering, title weighting), plus AI web search
- **Claim drafting** — 3-agent pipeline (Planner, Writer, Examiner) generates independent and dependent patent claims
- **Compliance checking** — 4-check automated validation (35 USC 112(a), 35 USC 112(b), MPEP 608, 35 USC 101) with traffic-light results and MPEP citations
- **Application generator** — 5-agent LangGraph pipeline assembles a complete USPTO-formatted application (background, summary, description, abstract, IDS); exports to Word (.docx, USPTO-compliant) or Markdown
- **Sidebar status badges** — visual indicators (green/red dots, spinners, counts) show pipeline step completion at a glance
- **Mobile-responsive sidebar** — collapsible accordion on small screens keeps main content visible
- API keys encrypted at rest (AES-256-GCM)
- Cost transparency with configurable cost cap
- Optional Bearer token authentication for network deployments
- 532 automated tests (Jest + Vitest + supertest + Playwright E2E + pytest) with GitHub Actions CI
- ESLint + Prettier + TypeScript strict mode + coverage thresholds enforced in CI
- Resume from interruption, individual stage re-run
- Legal guardrails — clickwrap, embedded disclaimers, watermarked exports, CC BY-SA prompt licensing

**What's new in v0.7.1:**
- **18 bug fixes** from external code review — run targeting race conditions, API key security (backend validation), cost cap scope (all pipelines), SSE error handling, request timeouts, component polling cleanup, claim regeneration context, settings defaults, resume sort order, DOCX filenames, delete confirmation text, Docker password parameterization, shared utility extraction, USPTO URL standardization, blockquote Word support, marked() consistency, finalReport type corruption fix

**What's new in v0.7.0:**
- **One-click installer** — Windows (.exe), Mac (.dmg, beta), Linux (.AppImage, beta). Download, install, launch. No Node.js, Python, or git required.
- **System tray app** — Go binary manages all 5 services with health monitoring, auto-restart, and log rotation
- **First-run wizard** — guides new users through API key setup on first launch

**What's next:**
- v0.8 — Auto-update mechanism, expanded platform support

If you're an inventor who's been through the patent process before, I'd love your feedback on whether this output would have been useful at the start of your journey.

— Scott

---

## Category: Q&A

### Post 1

**Title:** How much does it cost to run an analysis?

**Body:**

Each analysis run costs approximately **$0.75 to $3.00** in Anthropic API fees, depending on the complexity of your invention description and the model you choose.

- **Sonnet** (default) — best balance of quality and cost, typically $1-2 per run
- **Opus** — highest quality, ~$2-3 per run
- **Haiku** — cheapest, ~$0.50-1.00 per run, but lower quality output

PatentForge shows you a cost estimate before you confirm the run, so there are no surprises. You can also use a cheaper "research model" for Stage 2 (prior art search) to reduce costs while keeping the higher-quality model for the analysis stages.

You bring your own Anthropic API key — PatentForge doesn't charge anything on top of the API costs.

### Post 2

**Title:** Is my invention data private? What gets sent where?

**Body:**

PatentForge runs entirely on your computer. Your invention data stays local except for one thing: the Anthropic API call.

When you run an analysis, your invention description is sent to Anthropic's servers for AI processing. This is the same Claude API you'd be using if you chatted with Claude directly. You should review [Anthropic's data privacy policy](https://www.anthropic.com/policies/privacy) to understand how they handle API data.

Key points:
- PatentForge itself stores everything in a local SQLite database on your machine
- No data goes to PatentForge's servers (there aren't any)
- You use your own Anthropic API key, so you have a direct relationship with Anthropic
- No telemetry, analytics, or phone-home behavior

For pre-filing confidentiality, this is about as good as it gets for an AI-powered tool. But as always, discuss your confidentiality approach with your patent attorney.

### Post 3

**Title:** Can I use PatentForge output as-is for a patent filing?

**Body:**

**No.** PatentForge output is research to help you prepare for a consultation with a patent attorney. It is not a patent application, not a legal opinion, and not a substitute for professional legal counsel.

The AI can and does make mistakes — including fabricating patent numbers, misinterpreting case law, and presenting incorrect analysis with high confidence. Every finding should be independently verified by a qualified patent attorney.

Think of PatentForge like doing homework before a meeting. You'll walk in with your invention clearly described, related prior art identified, and smart questions ready. Your attorney still does the legal work.

---

## Category: Ideas / Feature Requests

### Post 1

**Title:** What features would make this more useful for your attorney meeting?

**Body:**

I'm planning the v0.7+ roadmap and would love input from people who've actually been through the patent process.

Some features I'm considering:
- **USPTO data integration** — pull in more structured patent data (classifications, citation trees, examiner statistics)
- **AI-assisted claim drafting research** — not actual claims, but structured analysis of what claim directions look like given the landscape
- **Comparison runs** — save multiple versions of your invention description and compare how the analysis changes
- **Attorney export customization** — let you configure what sections to include/exclude in the exported report

What would have been most valuable during your own patent journey? What questions did you not know to ask?

### Post 2

**Title:** International patent landscape support?

**Body:**

Right now PatentForge focuses on U.S. patent law (35 USC). I'm curious whether there's interest in:
- EPO (European Patent Office) landscape analysis
- PCT (Patent Cooperation Treaty) filing indicator analysis
- Jurisdiction comparison (US vs. EU vs. Japan vs. China)

This would be a significant expansion of the prompt system and prior art search. If you've dealt with international filings, what would be most helpful?

---

## Category: General

### Title: Welcome — How to Get Started and Where to Get Help

**Body:**

Welcome to the PatentForge community! Here are some quick pointers:

**Getting started:**
1. [README](https://github.com/scottconverse/patentforge/blob/master/README.md) — installation and quick start
2. [User Manual](https://github.com/scottconverse/patentforge/blob/master/USER-MANUAL.md) — step-by-step guide written for non-technical users
3. [Architecture](https://github.com/scottconverse/patentforge/blob/master/ARCHITECTURE.md) — how the system works under the hood

**Where to get help:**
- **Q&A** board — for specific questions about setup, usage, or behavior
- **Ideas** board — for feature suggestions and roadmap input
- **Bug reports** — use [GitHub Issues](https://github.com/scottconverse/patentforge/issues)

**Important reminder:** PatentForge is a research tool, not a legal service. Please read the [Legal Notice](https://github.com/scottconverse/patentforge/blob/master/LEGAL_NOTICE.md) before using the tool. Always consult a patent attorney before making filing decisions.

**Want to contribute?** Check out [CONTRIBUTING.md](https://github.com/scottconverse/patentforge/blob/master/CONTRIBUTING.md) for development setup and guidelines.

Looking forward to hearing from you!

---

## Category: Announcements — Release Notes

*Post each of these as a new Announcements discussion when the version ships.*

### Title: v0.1.0 — Initial Release

**Body:**

PatentForge v0.1.0 is the first public release. A complete 6-stage AI patent research pipeline with real-time streaming, invention intake form, HTML export, web search for prior art, rate limit handling, settings management, and Docker Compose deployment. Three-service architecture: NestJS backend, Express feasibility service, and React frontend.

### Title: v0.2.0 — Prior Art Search, Cost Tracking, Word Export

**Body:**

Big update. PatentsView API integration for automated prior art search with Haiku-powered query extraction and relevance scoring. LiteLLM dynamic pricing with cost confirmation before every run. Resume from interrupted stages. DOCX table rendering and Word download. SSE keepalive heartbeat prevents idle drops. Token streaming throttle prevents browser freeze.

### Title: v0.2.1 — Legal Guardrails

**Body:**

Added first-run disclaimer modal (unskippable clickwrap agreement), API key entry disclaimer on Settings page, and persistent export watermarks on all generated reports (HTML, Word, on-screen).

### Title: v0.2.2 — UPL Risk Mitigation

**Body:**

Comprehensive prompt language overhaul. AI now identifies as "patent landscape research assistant" instead of role-playing as an attorney. Assessment labels softened from "FILE NOW" to "INDICATORS FAVOR FILING". Stage disclaimers embedded in every output. Added LEGAL_NOTICE.md and dual licensing (MIT code, CC BY-SA 4.0 prompts so disclaimers survive forks).

### Title: v0.3.0 — USPTO Patent Detail, Stage Re-run, CSV Export

**Body:**

Click any prior art result to see a slide-out drawer with full patent data: dates, assignees, inventors, CPC classifications, abstract, and claims. Individual stage re-run without restarting the full pipeline. CSV export for prior art results. All enriched data cached locally for 30 days.

Note: PatentsView API was shut down during this release. Prior art search temporarily unavailable — AI web search in Stage 2 still works. Full ODP integration in v0.3.1.

### Title: v0.3.1 — USPTO Open Data Portal Integration

**Body:**

Replaces the shut-down PatentsView API with the new USPTO Open Data Portal. Prior art search and patent detail enrichment are back, now using the ODP API at data.uspto.gov. Add your free ODP API key in Settings to enable structured patent search. Without a key, AI web search in Stage 2 still handles prior art research. 86 automated tests.

### Title: v0.3.2 — Patent Claims Viewer

**Body:**

PatentForge can now show you the actual claims text for any prior art patent, right in the detail drawer.

**How it works:** When you click a prior art result and expand the "Claims" section, PatentForge fetches the patent's claims directly from the USPTO Documents API. It downloads the file wrapper, finds the most recent claims document, parses the ST96 XML, and displays the active (non-canceled) claims with a loading spinner while it works.

**Requirements:** You need a free USPTO Open Data Portal API key (get one at data.uspto.gov). Without a key, the existing "View on Google Patents" link still works.

This is one API call per patent, on-demand only. Your key, your quota.

### Title: v0.3.3 — Hardening: E2E Tests, Type Safety, DOCX Parser, Security

**Body:**

This release is all about quality and reliability — no new features, just making the existing ones more solid.

- **Playwright E2E test suite** — 21 browser tests covering navigation, project lifecycle, invention form, settings, and prior art panel. Tests capture screenshots, check browser console for errors, and verify responsive layout at mobile viewport. Runs automatically.
- **Type safety fix** — replaced loose `any` types in the feasibility service with proper Prisma types. Catches field-name typos at compile time instead of silently ignoring them.
- **DOCX parser improvements** — Word exports now handle italic text, inline code, numbered lists, and nested bullets correctly.
- **CORS restriction** — the internal feasibility service now only accepts requests from the backend, not any origin.
- **Interleaved-thinking header** — no longer sent to Haiku models that don't support it.

### Title: v0.4.0 — AI-Assisted Claim Drafting

**Body:**

The biggest feature since launch. PatentForge can now generate patent claim drafts using a 3-agent AI pipeline (Planner, Writer, Examiner) built with Python + LangGraph. Claims tab with editable text, UPL acknowledgment modal, DRAFT watermarks, collapsible strategy and examiner feedback. 3 independent claims (broad/medium/narrow) plus dependents, capped at 20 total. 40 Python tests.

### Title: v0.4.0 Hardening — 20-Issue Security and Reliability Audit

**Body:**

Following an independent technical review, we resolved all 20 identified issues:

**Security:** Server-side cost cap enforcement (pre-flight + mid-pipeline), internal service authentication via shared secret, API key removed from browser request bodies, path traversal prevention on export, HTML injection fix in report titles, timing-safe token comparison, per-installation encryption salt stored in database.

**Reliability:** Concurrent claim draft guard, stuck RUNNING draft cleanup on startup, structured JSON examiner verdict (replaces fragile string matching), per-agent 120s timeout, typed request bodies, input validation DTOs on all endpoints, prior art context size limits.

**CI/Testing:** Claim-drafter pytest added to CI and cleanroom script, Playwright E2E browser tests added to CI, 303 total tests across 4 layers.

**Correctness:** ODP scoring bias correction for title-only results, no silent model defaults (user must choose), inconsistent fallbacks removed.

### Title: v0.3.4 — Scoring, Encryption, CI, Auth

**Body:**

Five improvements focused on security, code quality, and developer experience:

1. **Smarter prior art scoring** — common patent stop-words ("comprising", "wherein", "apparatus", etc.) are now filtered out. Title matches score 2x higher than abstract matches. Less noise, more signal.

2. **API key encryption at rest** — your Anthropic and USPTO API keys are now encrypted with AES-256-GCM using a machine-derived key before being stored in the database. The plaintext key never hits disk.

3. **Prompt integrity checking** — SHA-256 hashes of all prompt files are computed at startup and logged. If a prompt file is modified while the service is running, you'll get a warning. Hashes are also available on the `/health` endpoint.

4. **GitHub Actions CI** — automated test pipeline runs Jest (backend), Vitest (frontend), and a full build check on every push and PR.

5. **Optional authentication** — set the `PATENTFORGE_TOKEN` environment variable to require Bearer token auth on all API requests. Off by default for single-user local installs, available for anyone running PatentForge on a network.

187 total tests across 3 layers. The foundation is solid for v0.4 (claim drafting).

---

### Title: v0.4.1 — Claim Tree Visualization & Patent Family Lookup

**Body:**

Two additions to the claim drafting workflow:

1. **Claim tree visualization** — SVG-based hierarchical view of patent claims showing independent/dependent relationships. Toggle between list and tree views in the Claims tab.

2. **Patent family tree lookup** — continuity data (parents, children, continuations, divisionals) fetched from the USPTO Open Data Portal and displayed in the patent detail drawer. Results cached with 30-day TTL.

Also fixed a flaky E2E test caused by a Vite proxy race condition during teardown.

---

### Title: v0.5.0 — Compliance Checking

**Body:**

New in v0.5.0: automated compliance checking for patent claim drafts.

Four specialized checker agents validate claims against legal requirements:

1. **35 USC 112(a)** — written description adequacy
2. **35 USC 112(b)** — definiteness (antecedent basis, ambiguous terms)
3. **MPEP 608** — formalities (claim format, numbering, dependency chains)
4. **35 USC 101** — patent eligibility (Alice/Mayo framework)

Results show as a traffic-light report (PASS/FAIL/WARN) per claim with MPEP citations and actionable fix suggestions. You can edit claims and re-check to verify fixes.

Also added: individual claim regeneration and prior art overlap warnings on claims whose terms match known prior art references.

New compliance-checker service runs on port 3004 (Python + FastAPI + LangGraph), authenticated via the same internal service secret as claim-drafter.

### Title: v0.5.1 — Public Release Polish

**Body:**

v0.5.1 is a patch release focused on production readiness and polish.

**Fixed:**
- Hardcoded localhost URLs in Prior Art panel (broke any non-localhost deployment)
- CORS now configurable via `ALLOWED_ORIGINS` env var across all services
- Claim parser stops at AI-appended revision notes instead of including them in claim text
- Report iframe shows loading spinner instead of blank flash
- Consistent button labels ("Re-run" everywhere)
- Accessibility: aria-labels on spinners, keyboard nav for claim tree, status roles on toasts

**Improved:**
- PatentForge.ps1 launcher auto-installs missing npm dependencies, verifies all ports after startup
- README quick start covers all 5 services with troubleshooting section
- CONTRIBUTING.md fixed for current 5-service architecture
- Added `.env.example` documenting all configurable environment variables

### Title: v0.5.2 — Quality Patch (13 Items from Tech/UI/QA Review)

**Body:**

v0.5.2 addresses 13 specific items identified in an external tech/UI/QA review. No new features — all polish and hardening.

**Highlights:**
- Shared `<Alert>` component replaces inconsistent error styling across 5 components
- Styled delete confirmation modal replaces browser `confirm()` dialog
- Claim editing now discoverable: pencil icon on hover, text cursor, border highlight
- Tablet-responsive layout at 768px breakpoint
- Encryption self-test on startup warns loudly if database was moved between machines
- Prior-art API calls now timeout at 60 seconds instead of hanging indefinitely
- Docker Compose no longer ships with a default internal secret — must be generated
- CI now tests the compliance-checker service
- 396 automated tests (up from 394)

### Title: v0.6.0 — Full Application Document Assembly

**Body:**

v0.6.0 ships the application generator — PatentForge can now draft a full patent application document from your feasibility analysis and claim drafts.

**What's new:**
- New `application-generator` service (Python/FastAPI, port 3003) with a 5-node LangGraph pipeline
- Generates cover sheet, specification, abstract, description of drawings, and detailed description
- Prior art IDS table (PTO/SB/08 format) included automatically
- Export to Word (.docx) or Markdown
- Wired into Docker Compose and local launchers (PatentForge.ps1 / PatentForge.bat)

### Title: v0.7.0 — One-Click Installer

**Body:**

PatentForge now has a proper installer. Download, double-click, and you're running — no Node.js, Python, or git required.

**What's included:**
- **Windows installer** (.exe via Inno Setup) — full installer with Start Menu shortcuts and uninstaller
- **Mac installer** (.dmg, beta) — drag to Applications
- **Linux installer** (.AppImage, beta) — chmod +x and run
- **System tray app** (Go) — manages all 5 services with health monitoring, auto-restart on crash, and log rotation
- **Node SEA binaries** — backend and feasibility compiled to standalone executables (no Node.js runtime)
- **Portable Python 3.12** — bundled for the 3 Python services
- **First-run wizard** — walks new users through API key setup on first launch
- **CI release workflow** — GitHub Actions builds all 3 platform installers automatically on tag push

Download from the [Releases page](https://github.com/scottconverse/patentforge/releases/latest). Mac and Linux are beta — please report issues.

### Title: v0.6.1 — Hardening Patch

**Body:**

v0.6.1 is a hardening patch based on an external sprint review. No new features — just making the existing stack safer and more accessible.

**What changed:**
- Docker no longer runs `--accept-data-loss` on startup — schema changes that would drop data now fail explicitly
- Backend port is configurable via `PORT` environment variable (default: 3000)
- Backend validates environment on boot and fails fast with actionable error messages
- Runtime source maps enabled — stack traces now point to TypeScript source, not compiled JS
- Form labels properly linked to inputs for screen readers and keyboard navigation
- Disclaimer modal has correct ARIA dialog semantics
- New Playwright E2E test exercises the real first-run disclaimer flow (no localStorage bypass)
- Removed deprecated `version` key from docker-compose.yml
