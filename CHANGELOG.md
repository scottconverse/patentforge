# Changelog

All notable changes to PatentForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.1] - 2026-04-07

### Changed
- **Assessment labels aligned to v1.2.0 legal posture** — "INDICATORS FAVOR FILING" became "LANDSCAPE FAVORS FILING", "GATHER MORE EVIDENCE" became "MORE DOCUMENTATION WOULD STRENGTHEN POSITION", "INDICATORS SUGGEST NOT FILING" became "SIGNIFICANT OBSTACLES IDENTIFIED", "CONSIDER DESIGN PATENT ONLY" became "DESIGN PATENT AVENUE WORTH EXPLORING". Labels now match patent-analyzer-app v1.2.0 across all three repos.
- **Enhanced AI disclaimer across all services** — All 4 services' common-rules.md updated to v1.2.0 disclaimer text, adding explicit warnings about fabricated patent numbers, inaccurate legal citations, and incorrect statutory interpretations presented with high confidence.

### Added
- **50-word minimum description validation** — Feasibility pipeline now requires at least 50 words in the invention description before running. Frontend shows inline error with guidance on what detail to add. Backend returns 400 with word count and actionable message. Prevents low-quality pipeline runs on vague descriptions.
- 37 new tests (17 Jest backend + 20 Vitest frontend), bringing total to 665 (254 Jest + 173 Vitest + 183 pytest + 55 Playwright E2E)

## [0.9.0] - 2026-04-07

### Fixed
- **Application sections empty** — Application tab's 9-section structured navigation now works end-to-end. The `astream` loop in the application-generator service was replacing accumulated state with each node's partial output instead of merging it, causing all generated section content (background, summary, detailed description, abstract, figure descriptions) to be lost. Fixed by using `state_dict.update(node_state)` to accumulate fields across nodes.
- **Application generation progress** — Added elapsed timer and guidance copy ("Application generation typically takes 2–4 minutes. You can navigate away — it will continue in the background.") to the Application tab spinner, consistent with Claims and Compliance tabs. Extracted shared `useElapsedTimer` hook to avoid duplication.
- **Streaming horizontal scrollbar** — Long patent URLs in prior art research output (Stage 2) caused horizontal overflow and a scrollbar in the streaming panel. Fixed by adding `overflow-x-hidden` and `break-words` to the streaming content container.

### Added
- **E2E: multiple projects** — Playwright test covering create 3 projects, verify list, delete one, verify cascade, navigate into remaining projects.
- **E2E: cancel mid-pipeline** — Playwright test for cancelling at Stage 2, verifying clean cancelled state and "Run from Start" button appears.
- **E2E: resume from failed stage** — Playwright test verifying Resume button appears after a `stage_error` event, and does not appear after a `cancelled` event.
- **E2E: edit invention after feasibility** — Playwright test for editing description and title on a project with a completed mocked pipeline.
- **E2E: draft persistence** — Playwright test saving all 11 invention fields via UI, reloading, and verifying all fields restored from the backend.
- **E2E: download/export buttons** — Playwright test skeleton for all 6 export buttons (Feasibility HTML/Word, Claims Word, Compliance Word, Application HTML/Word); skips gracefully when no completed project exists.
- **`useElapsedTimer` hook** — Shared React hook (`frontend/src/hooks/useElapsedTimer.ts`) returning `{ elapsed, formatted }` with start/stop controlled by a boolean prop.
- 628 automated tests (237 Jest + 153 Vitest + 183 pytest + 55 Playwright E2E)

## [0.8.5] - 2026-04-07

### Fixed
- **CRITICAL: Installer auth — Python services reject backend requests** — `PatentForge.ps1` used `cmd.exe set VAR=value &&` which includes a trailing space in the env var value; all three Python services (claim-drafter, compliance-checker, application-generator) compared `"patentforge-internal "` ≠ `"patentforge-internal"` and returned 403 on every request. Claims, Compliance, and Application were completely non-functional from a fresh install. Fixed by removing the space before `&&`.
- **Stage data lost on view transition** — after a feasibility pipeline completed or errored, navigating from the running view back to the overview caused all stage cards to lose their completion indicators (green checks, times, costs, "view" links). Root cause: `displayStages` used `latestRun.stages` (which excludes `outputText`) for overview mode because `stagesAreReal` required a `feasibilityRunId` that was never set during streaming. Fixed by tagging stages with the run ID at pipeline start.
- **Stage cards not clickable after completion** — completed stages showed "Re-run" but no "view" link on the overview page, preventing users from reviewing individual stage output. Resolved by the same `stagesAreReal` fix above — stages now carry `outputText` through view transitions.
- **Claims tab freezes Chrome (37 claims)** — all 37 claims rendered simultaneously with `markdownToHtml()` + `dangerouslySetInnerHTML` on mount, crashing the browser. Fixed with collapse-by-default accordion — claim headers render immediately, full text and markdown conversion only happen when a user clicks to expand a specific claim.
- **Compliance tab freezes Chrome (154 results)** — all 4 rule sections started expanded (`new Set(RULE_ORDER)`), rendering 154 results at once. Fixed by starting all sections collapsed (`new Set()`).
- **Raw JSON in pipeline error banner** — when the Anthropic API returned an error (rate limit, auth failure), the UI displayed the raw JSON response `{"type":"error","error":{"type":"invalid_request_error",...}}` instead of a human-readable message. Fixed by parsing the JSON to extract the `error.message` field.
- **Project status stale after pipeline errors** — the breadcrumb badge stayed "INTAKE" after a pipeline completed or errored until the user manually refreshed the page. Fixed by calling `loadProject()` in all three error paths (pipeline_error event, connection lost, catch block).
- **"Pipeline interrupted" on stages that never ran** — when a pipeline failed at stage 4, stages 5 and 6 (which never started) showed "Pipeline interrupted — service was restarted or browser was closed." Fixed to show "Not started — pipeline stopped before reaching this stage" for PENDING stages vs the interrupt message for stages that were actually RUNNING.
- **No validation message for empty project title** — clicking Create with an empty title did nothing (button was `disabled` when empty, preventing form submission). Fixed by allowing the button to submit so the inline validation message "Project title is required." can appear.
- **Claims error shows no detail** — "Claim generation failed." with no information about why. Now surfaces `errorMessage` from the backend response.
- **Compliance error shows no detail** — same pattern as claims; now surfaces `errorMessage` from the backend response.
- **Backend root `/` returns raw 404** — hitting `http://localhost:3000/` returned `{"message":"Cannot GET /","error":"Not Found","statusCode":404}`. Added a root handler that returns API version, status, and endpoint directory.

### Changed
- **Claims tab UX** — independent claims now display as an expandable accordion with claim number, type, scope level, and dependent claim count visible in the collapsed header. Click to expand shows full claim text, edit capability, regenerate button, and prior art overlap warnings.
- **Compliance tab UX** — rule category sections now start collapsed with pass/fail indicator dots and result counts visible in the header. Users expand individual sections to see detailed results.

## [0.8.4] - 2026-04-06

### Fixed
- **Windows installer: cross-platform build script** — `services/feasibility` build script replaced Unix `cp` command with cross-platform Node.js inline file copy; fresh installs on Windows no longer fail at the prompt-copying step
- **Windows installer: PATHEXT enforcement** — `PatentForge.ps1` now explicitly sets `PATHEXT` before invoking npm, preventing `.cmd` extension resolution failures in stripped Windows shell environments

## [0.8.3] - 2026-04-05

### Added
- **Settings: auto-export opt-in** — new `autoExport` boolean (defaults to true) with toggle in Settings UI
- **Docker: healthchecks** — all 7 services now have healthchecks; frontend depends on backend being healthy
- **Docker: log rotation** — json-file driver with 10 MB max-size, 3-file rotation on all services
- **CI: Node 24 migration** — `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` env var set preemptively
- **Coverage thresholds bumped** — backend 44/38/32/43, frontend 38/38/32/38
- **Code quality: shared utilities** — extracted `slugify()` and disclaimer text to shared modules (`frontend/src/utils/slugify.ts`, `frontend/src/utils/disclaimer.ts`, `backend/src/utils/`)

### Changed
- **Code quality: lint cleanup** — all `any` types replaced with proper interfaces (`ClaimDrafterResponse`, `AppGeneratorResponse`); unused variables fixed; bonus: `application.service.ts` cost cap now includes claimDraft costs

### Fixed
- **CI: package-lock.json version mismatch** — lockfile version was 0.8.1 while package.json was 0.8.2, causing `npm ci` to fail in CI
- **decrypt() silent failure** — `decrypt()` now throws `DecryptionError` instead of silently returning ciphertext when decryption fails (e.g., database moved to a different machine); settings service catches this and shows a clear warning banner in the UI
- **Report auth** — `ReportViewer` iframe and HTML download now use `fetch` + `srcdoc`/`blob` instead of direct URLs, working with `PATENTFORGE_TOKEN` auth; `AuthGuard` also accepts `?token=` query param fallback
- **Orphaned nginx block** — removed `/feasibility/` proxy block from `nginx.conf`; SSE settings moved to `/api/` proxy
- **Stale projectLoadedRef** — view init ref resets when project ID changes; stale RUNNING runs now show overview (not report) for direct re-run access
- **Concurrent run guard** — `isRunningRef` prevents overlapping SSE streams from rapid Resume/Cancel/Resume

### Security
- **API key rate limiting** — `@nestjs/throttler` added; `validate-api-key` endpoint limited to 5 requests per 60 seconds

## [0.8.2] - 2026-04-05

### Added
- **Helmet security headers** — backend now sets security headers (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.) via Helmet middleware for networked deployments; CSP intentionally disabled for frontend compatibility
- **DOMPurify on all backend HTML generation** — all four `marked()` call sites in the backend and feasibility service are now sanitized through `isomorphic-dompurify`, closing the XSS surface on server-rendered HTML (report exports, DOCX generation)
- **ClaimDraft cost tracking** — claim drafting pipeline costs are now saved to the database and included in cumulative project cost calculations and cost cap enforcement; previously the Python service returned cost data but the backend silently discarded it
- **Application-generator CI job** — the application-generator service (64 tests) now runs in GitHub Actions CI alongside the other Python services; also added to the build verification gate
- **`markdownToHtml` regression tests** — 11 unit tests proving the frontend markdown utility escapes `<script>` tags, inline event handlers, and raw HTML while preserving markdown-generated tags; safety claim now backed by tests, not just code reading
- **Claim parser blocklist filter** — replaced narrow allowlist (`_VALID_CLAIM_START`) with a blocklist (`_NOT_CLAIM_OPENER`) that rejects known non-claim text (notes, strategies, summaries) while allowing unusual but valid patent claim formats like "In a method..." and "According to one embodiment..."

### Changed
- **ProjectDetail.tsx decomposition (phase 2)** — extracted 6 more units from the 616-line coordinator: `useViewInit` hook, `useReportContent` hook, `ContentPanel`, `RunningView`, `ReportView`, and `StageOutputViewer` components; coordinator reduced to 385 lines with pure orchestration logic
- **Prisma strategy consolidation** — eliminated dual-schema drift by deleting the severely outdated `schema.postgres.prisma` (missing 3 models, dozens of fields) and 10 stale SQLite migration files; Docker now derives the PostgreSQL schema automatically from the canonical `schema.prisma` via `sed`; all environments (local, CI, Docker) consistently use `prisma db push`
- **`npm ci` everywhere** — frontend CI jobs, backend Dockerfile, and frontend Dockerfile all switched from `npm install` to `npm ci` for deterministic, lockfile-based installs
- **Backend build cleanup** — `npm run build` now runs `rimraf dist && nest build`, preventing stale compiled output from surviving source renames or deletions
- **ts-jest upgraded to 29.4.9** — latest available patch; ESM parse failures from `isomorphic-dompurify` resolved via Jest `moduleNameMapper` mock (DOMPurify behavior tested in frontend unit tests); 49 previously-hidden backend tests now running and passing
- **Claims badge contrast** — count pill on active (blue) sidebar tabs now uses `bg-white/25 text-white` instead of dark green, fixing the low-contrast readability issue
- **Claim text rendering** — claim text, Planner Strategy, and Examiner Feedback sections in the Claims tab now render markdown via `markdownToHtml` instead of displaying raw markdown source
- **Claim parser trailing notes** — `_strip_trailing_notes` stop pattern expanded to catch `###`+ headings and `**Bold` section headers that AI models append after claim text

### Fixed
- **Backend cost-cap tests** — 8 cost-cap tests that were masked by suite-level ESM parse failures are now running and updated to include ClaimDraft in cumulative cost mocks
- **Non-claim content in claims 31–32** — items like "Consider adding claims..." and "Strategy note: Evidence for..." are now filtered out by the blocklist-based `_is_valid_claim_text` instead of being treated as valid claims

### Security
- **Helmet** — X-Content-Type-Options, X-Frame-Options, HSTS, and other security headers now set on all backend responses
- **DOMPurify** — server-side HTML sanitization on all `marked()` outputs prevents XSS in exported reports and DOCX documents

## [0.8.1] - 2026-04-05

### Fixed
- **Back button during streaming** — navigating to a sidebar tab (Prior Art, Claims, Compliance, Application) while the feasibility pipeline is actively streaming no longer loses the live output; clicking "← Back" from any sidebar tab now returns to the streaming view when a pipeline is running, instead of jumping to the project overview

## [0.8.0] - 2026-04-04

### Added
- **Backend integration tests** — 19 HTTP-level tests using supertest covering projects CRUD, settings, and auth guard behavior (validates controllers, validation pipes, and guards through actual HTTP requests)
- **ESLint + Prettier** — code style enforcement for both backend and frontend with CI integration; `npm run lint` and `npm run format:check` available in both packages
- **Coverage thresholds** — backend (Jest) and frontend (Vitest) enforce minimum coverage; CI fails if coverage regresses below baseline
- **Sidebar status badges** — Prior Art, Claims, Compliance, and Application buttons now show completion status: green dot (complete), spinner (running), red dot (error), with result counts where applicable
- **Mobile sidebar accordion** — on small screens, Pipeline and Actions sections collapse by default so main content is immediately visible; tap to expand
- **Navbar "Projects" link** — active state indicator for Projects and Settings navigation items
- **Retry button** — project error state now shows a "Retry" button alongside "Back to Projects"
- **History run actions** — ERROR and CANCELLED historical runs show "Re-run" button and "No report available" label instead of dead-end cards
- **Pre-push git hook** — `scripts/hooks/pre-push` runs `verify-release.sh` automatically before every push; install with `bash scripts/install-hooks.sh`
- **Model pricing utility** — hardcoded pricing in `frontend/src/utils/modelPricing.ts` replaces external fetch

### Changed
- **ProjectDetail decomposition** — split 1,486-line monolith into focused units: 3 custom hooks (`useProjectDetail`, `useRunHistory`, `useFeasibilityRun`) and 3 components (`ProjectSidebar`, `ProjectOverview`, `RunHistoryView`); coordinator component reduced to 615 lines
- **TypeScript strictness** — backend: enabled `forceConsistentCasingInFileNames`, `strictBindCallApply`, `noImplicitAny` (zero compiler errors). Frontend: enabled `strictNullChecks` (zero compiler errors)
- **Stage name display** — removed CSS truncation from StageProgress; stage names now wrap naturally instead of showing "Technical Intak..."
- **Sidebar width** — minimum width prevents stage name truncation on desktop
- **Docker frontend healthcheck** — nginx container reports health status via curl probe
- **CI pipeline** — now runs lint, coverage checks, and integration tests in addition to unit tests

### Removed
- **External pricing fetch** — removed outbound request to `raw.githubusercontent.com/BerriAI/litellm` for privacy; pricing data is now hardcoded and updated manually each release

### Fixed
- **Backend build path** — added missing `tsconfig.build.json` that caused `nest build` to output to `dist/src/main.js` instead of `dist/main.js`, breaking `npm run start` and `PatentForge.bat`

## [0.7.1] - 2026-04-03

### Fixed
- **Run targeting** — `patchRun` and `patchStage` now accept optional `runId` to prevent race conditions when multiple runs exist; previously always targeted the latest version, risking data corruption during rapid re-runs
- **Cancel after abort** — `cancelRun` returns 200 OK when no running run is found instead of 404, eliminating the error toast when cancellation races with pipeline completion
- **API key security** — first-run wizard now validates API keys via a backend endpoint (`POST /api/settings/validate-api-key`) instead of sending keys directly from the browser to Anthropic; removed `anthropic-dangerous-direct-browser-access` header
- **SSE error handling** — upstream service crashes now send a `pipeline_error` SSE event instead of silently closing the stream, preventing indefinite "Loading" states
- **Request timeouts** — all non-streaming API calls have a 30-second timeout with a user-friendly error message instead of hanging indefinitely
- **Polling cleanup** — Claims, Compliance, and Application tabs stop polling on unmount, preventing state updates on unmounted components
- **Cost cap scope** — cost cap now aggregates costs across feasibility, compliance, and application pipelines (previously only checked feasibility costs, allowing other pipelines to bypass the cap)
- **Claim regeneration context** — regenerated claims now receive the same feasibility analysis (stages 5/6) and prior art context as the original draft, instead of empty strings
- **Settings defaults** — UI defaults match database schema (32,000 max tokens, 5-second inter-stage delay); previously mismatched at 16,000 and 2 seconds
- **Resume sort** — stage list sorted by number before resume iteration, preventing miscalculated resume points if stages arrive out of order
- **DOCX filenames** — claims and compliance Word exports now include project ID in filename instead of generic `claims.docx` / `compliance.docx`
- **Delete confirmation** — project deletion dialog now mentions patent application drafts alongside analysis data, claims, and compliance results
- **Docker credentials** — PostgreSQL password parameterized via `${POSTGRES_PASSWORD:?...}` environment variable, matching the existing pattern for `INTERNAL_SERVICE_SECRET`
- **statusColors duplication** — extracted to shared utility (`frontend/src/utils/statusColors.ts`) instead of duplicated in ProjectList and ProjectDetail
- **USPTO URL** — standardized IDS warning link from beta endpoint to production (`data.uspto.gov/myodp`)
- **Blockquote DOCX** — added blockquote (`> `) handling to the Word document parser with proper indentation
- **marked() consistency** — all `marked()` calls use consistent synchronous pattern (matched to marked v17 behavior)
- **finalReport type** — project list no longer type-corrupts `finalReport` from string to boolean; uses `hasReport` boolean flag instead

## [0.7.0] - 2026-04-02

### Added
- **Windows installer (Inno Setup)** — download, double-click, install, launch from system tray. No Node.js, Python, or git required.
- **Mac installer (.dmg, beta)** — drag to Applications
- **Linux installer (AppImage, beta)** — download, chmod +x, run
- **System tray app (Go)** — manages all 5 services with health monitoring, auto-restart on crash, and log rotation
- **Node SEA binaries** — backend and feasibility compiled to standalone executables via Node.js Single Executable Applications (no Node.js runtime needed)
- **Portable Python 3.12** bundled for claim-drafter, application-generator, and compliance-checker services
- **First-run API key setup wizard** — guides new users through Anthropic API key configuration on first launch
- **Health endpoint on backend** — `GET /api/health` returns service status
- **CI release workflow** — GitHub Actions builds all 3 platform installers on tag push (`v*`)
- **Download section on landing page** — per-platform download buttons with size estimates

### Changed
- Backend routes moved to `/api/*` global prefix (frontend API calls unchanged — proxy config updated)
- Backend serves frontend static files in production mode via `@nestjs/serve-static`
- Backend validates `FRONTEND_DIST_PATH` and `NODE_ENV` on startup

## [0.6.1] - 2026-04-02

### Fixed
- **Docker data safety** — removed `--accept-data-loss` from Dockerfile startup command; schema changes that would drop columns or tables now fail explicitly instead of silently destroying data
- **Configurable backend port** — backend reads `PORT` from environment (default: 3000) instead of hardcoding, supporting non-standard deployments and the upcoming installer
- **Source maps at runtime** — added `--enable-source-maps` to all backend start commands (dev, production, Docker) so stack traces map to TypeScript source instead of compiled JS
- **Startup environment validation** — backend now validates `DATABASE_URL` on boot and fails fast with actionable error messages instead of cryptic runtime failures; warns about missing `ANTHROPIC_API_KEY`; requires `INTERNAL_SERVICE_SECRET` in production
- **Docker Compose deprecation** — removed deprecated `version: "3.9"` key (Compose v2+ ignores it)
- **Form accessibility** — added `htmlFor`/`id` linkage on all InventionForm fields (title, description, 9 optional fields) so labels are properly associated with inputs for screen readers and keyboard navigation
- **Modal accessibility** — added `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` to the disclaimer modal for proper screen reader announcement and focus management

### Added
- **Disclaimer E2E test** — new `disclaimer.spec.ts` with 3 Playwright tests exercising the real first-run flow (no localStorage bypass): modal appearance, accept-and-persist, and required legal content verification

## [0.6.0] - 2026-04-02

### Added
- **Patent application generator** — new Python/FastAPI service (port 3003) with 5 sequential LangGraph agents (background, summary, detailed description, abstract, figure descriptions) that assemble a complete USPTO-formatted patent application from feasibility analysis, prior art, and claim drafts
- **Application tab** — new tab in project detail with section navigation (9 sections), inline editing, UPL disclaimer modal, and export toolbar
- **USPTO-compliant DOCX export** — Word export follows 37 CFR 1.52: US Letter, Times New Roman 12pt, 1.5 line spacing, [NNNN] bold paragraph numbering, page numbers, claims/abstract on separate pages
- **DOCX watermark** — every page includes diagonal "DRAFT — NOT LEGAL ADVICE — MUST BE REVIEWED BY PATENT ATTORNEY" watermark
- **Markdown export** — full application as formatted Markdown with paragraph numbers and IDS table
- **Information Disclosure Statement** — IDS table auto-generated from prior art search results
- **Cross-references placeholder** — user-editable section for related application references with actionable empty state guidance
- **Application generator Docker service** — `application-generator` added to `docker-compose.yml` on port 3003

### Fixed
- **Cost tracking** — fixed field name mismatch (`estimated_cost_usd` → `total_estimated_cost_usd`) that prevented API cost from being recorded
- **Markdown headers in LLM output** — finalize node now strips `#` header lines from agent output before saving to database
- **Stale claim status** — switching to Compliance or Application tabs now re-fetches claim draft status, fixing "Draft claims first" showing after claims were generated
- **IDS section key mismatch** — fixed `ids` → `idsTable` mapping so IDS data renders when prior art exists
- **IDS empty state** — shows actionable warning with USPTO API key signup URL and step-by-step instructions instead of silently showing empty section
- **Mobile layout** — section navigation and content panel now stack vertically on mobile (was side-by-side and cramped)
- **Cross-references empty state** — shows explanation of what belongs here and "Add Cross-References" button instead of generic "No content" message
- **React Router deprecation warnings** — added v7 future flags (`v7_startTransition`, `v7_relativeSplatPath`) to suppress console warnings
- **Edit button accessibility** — added `aria-label` with section name for screen readers

## [0.5.2] - 2026-04-02

### Added
- **Shared `<Alert>` component** — consistent error/warning/info/success styling across ProjectList, InventionForm, ClaimsTab, ComplianceTab, and PriorArtPanel
- **Styled delete confirmation modal** — replaces browser `confirm()` dialog with a dark-themed modal matching the existing CostConfirmModal pattern
- **Claim editing pencil icon** — visible edit icon on hover with `cursor: text` and border, so users can discover click-to-edit
- **Tablet-responsive layout** — project detail sidebar stacks above content at `<768px` via Tailwind `md:` breakpoints
- **Encryption startup self-test** — backend logs `ERROR` on startup if encrypt/decrypt round-trip fails (e.g. database moved between machines), prompting user to re-enter API keys
- **Encryption migration tests** — 2 new tests for corrupted ciphertext and truncated hex fallback paths (total: 396 tests)
- **Compliance checker CI job** — GitHub Actions now runs compliance-checker pytest suite and installs it for E2E tests
- **Invention description character cap** — 8,000-character limit on description field with live remaining-character counter (amber at 500 remaining)

### Fixed
- **ComplianceTab function hoisting** — `handleDownloadDocx` moved above conditional returns so it's always initialized before use
- **Prior-art API timeout** — Anthropic API calls in `extractSearchQueries` now have a 60-second `AbortSignal.timeout` to prevent hanging
- **README Stage 4 description** — corrected from "AI/ML and 3D printing" to "domain-specific landscape analysis" (the prompt is adaptive)
- **Docker secret default** — replaced insecure `patentforge-internal` fallback with `${INTERNAL_SERVICE_SECRET:?...}` that errors if unset, with documented `openssl rand -hex 32` command
- **Missing database migration** — `OdpApiUsage` and `PatentFamily` tables were in the Prisma schema but had no migration, causing 500 errors on `/settings/odp-usage` and patent family lookups from a fresh database

### Changed
- **OS color scheme** — added `color-scheme: dark` declaration and subtle light-mode body adjustment via `prefers-color-scheme` media query
- **CI E2E job** — compliance-checker now installed alongside claim-drafter in the Playwright E2E pipeline

## [0.5.1] - 2026-04-02

### Fixed
- **Production blocker**: hardcoded `localhost:3000` URLs in Prior Art panel now use `/api` proxy
- **CORS**: all services now read `ALLOWED_ORIGINS` env var (defaults to `http://localhost:8080`)
- **Claim parser**: stops at AI-appended revision notes (`---`, `## CLAIM SUMMARY`, etc.) instead of including them in claim text
- **Claim text length**: enforces 5000-char max per claim with `[...text truncated]` marker
- **Report iframe**: shows loading spinner while report renders; no more blank flash
- **Button labels**: standardized "Re-run" everywhere (was "Retry"/"re-run"/"Run Again")
- **Accessibility**: `aria-label="Loading"` on all spinners, keyboard nav for claim tree, `role="status"` on toasts
- **Console noise**: removed `console.error`/`console.warn` from production frontend code

### Changed
- PatentForge.ps1 launcher: auto-installs missing npm dependencies, verifies all ports after startup, shows per-service status
- README.md: complete quick start with all 5 services, Python deps, troubleshooting section
- CONTRIBUTING.md: fixed paths, added all 5 services, Docker-is-optional note
- Added `.env.example` with all configurable env vars documented
- Docker-compose.yml: security warnings for `INTERNAL_SERVICE_SECRET`

## [0.5.0] - 2026-04-01

### Added
- **Compliance checking** — four automated checks validate patent claim drafts against legal requirements: 35 USC 112(a) written description adequacy, 35 USC 112(b) definiteness (antecedent basis, ambiguous terms), MPEP 608 formalities (claim format, numbering, dependency chains), and 35 USC 101 patent eligibility (Alice/Mayo framework)
- **Traffic-light compliance report** — expandable results view with PASS/FAIL/WARN status per claim, MPEP section citations, and actionable fix suggestions
- **Re-check after claim edits** — re-run compliance checks after editing claims to verify fixes
- **Individual claim regeneration** — regenerate a single claim via the claim drafter without re-running the entire pipeline
- **Prior art overlap warnings** — amber warning icons on claims whose terms overlap with known prior art references
- **Compliance checker service** — new Python + FastAPI + LangGraph service (port 3004) with four specialized checker agents, internal service authentication, and per-check cost tracking
- **UPL compliance modal** — per-project acknowledgment required before running compliance checks, consistent with claim drafting guardrails
- **Claims DOCX export** — "Export Word" button on Claims tab generates a Word document with formatted claims and UPL disclaimer
- **Compliance DOCX export** — "Export Word" button on Compliance tab generates a Word document with results, MPEP citations, and suggestions
- **ODP API usage tracking** — new OdpApiUsage table tracks queries, results, and rate limits per search; weekly summary displayed in Settings page
- **Accurate cost estimates** — cost confirmation modal now shows estimates within 25% of actual cost based on historical run data, labeled "Based on N previous runs" or "Estimated (no run history)"
- **Settings page breadcrumb** — "Projects / Settings" breadcrumb for back navigation
- **391 automated tests** — 220 backend (Jest) + 62 frontend (Vitest) + 59 claim-drafter (pytest) + 50 compliance (pytest)

### Changed
- Settings API key fields no longer trigger Chrome's password save popup (autocomplete fix)
- Settings "Output Folder" help text now accurately describes server vs browser download behavior

### Fixed
- Claim parser duplicate numbering — parent references now updated correctly when claims are renumbered
- Feasibility report/export fallback — uses stage 6 output when finalReport is null
- Cost confirmation modal was showing approximately 3x actual cost (was using maxTokens as output estimate instead of historical data)

### Security
- Compliance checker service authenticated via `INTERNAL_SERVICE_SECRET` (same pattern as claim-drafter)
- Port 3004 internal only in Docker (not exposed to host)
- "RESEARCH OUTPUT — NOT LEGAL ADVICE" header on all compliance results

## [0.4.1] - 2026-04-01

### Added
- **Claim tree visualization** — SVG-based hierarchical view of patent claims showing independent/dependent relationships. Toggle between list and tree views in the Claims tab. Independent claims render as blue nodes, dependent claims as gray, with connector lines showing parent-child hierarchy.
- **Patent family tree lookup** — new `GET /patents/:patentNumber/family` endpoint fetches continuity data (parent, child, continuation, divisional, CIP relationships) from the USPTO Open Data Portal. Results cached in a new `PatentFamily` Prisma model with 30-day TTL. The PatentDetailDrawer now has a collapsible "Patent Family" section that lazy-loads family members on expand, showing relationship type, status (granted/pending/abandoned), filing/grant dates, and links to Google Patents.

### Fixed
- **Flaky project-lifecycle E2E test** — the "navigate to project detail" test failed ~50% of the time with a 404 console error. Root cause: Vite proxy race condition where `afterEach` deleted the project via direct API call before the browser's proxied `loadProject()` fetch completed. Fixed by waiting for the project detail page to fully render before allowing teardown.

## [0.4.0] - 2026-03-31

### Fixed (CI & Testing)
- **CI frontend install** — switched from `npm ci` to `npm install` for the frontend in GitHub Actions. `npm ci` fails cross-platform because esbuild's platform-specific optional binaries aren't all present in a lockfile generated on a different OS.
- **CI claim-drafter setup** — added Python 3.12 setup and `pip install .` to the E2E job, which was missing the claim-drafter service entirely.
- **Cross-platform export-path test** — `resolveExportDir('C:\\Windows\\System32')` assertion now platform-conditional. On Linux, `path.resolve` treats Windows paths as relative, so the test only asserts on Windows.
- **Playwright workers serialized** — set `workers: 1` to prevent SQLite race conditions when multiple test files share the same database.
- **Playwright claim-drafter webServer** — added claim-drafter to the Playwright webServer config so E2E tests launch all 4 services.
- **Cross-platform uvicorn startup** — changed claim-drafter webServer command from `uvicorn` to `python -m uvicorn` so it works on Windows (where the venv `Scripts/` dir may not be on PATH).
- **ODP mock test sequencing** — changed persistent `mockResolvedValue` to chained `mockResolvedValueOnce` calls, preventing mock bleed across sequential queries.
- **ODP rate-limit delay assertions** — multi-query and 429-retry tests now use `jest.useFakeTimers()` with `jest.spyOn(global, 'setTimeout')` to verify the 1.5s inter-query delay and 10s 429-retry delay actually fire.
- **Claim-draft test async leak** — added missing `claimDraft.findUnique` mock, `console.error` spy, and a 10-iteration `setImmediate` drain loop to prevent the fire-and-forget pipeline IIFE from crashing after Jest teardown.
- **Cleanroom E2E includes Playwright** — cleanroom script now starts all 4 services and runs the full 31-test Playwright E2E suite as Phase 7 before declaring safe to push.

### Fixed
- **PriorArtSearch P2025 race condition** — background prior art search crashed with "Record to update not found" when a project was deleted while the search was still running. The catch block's status update is now wrapped in a try-catch to handle cascade-deleted records gracefully.
- **Dead PatentsView API removed as fallback** — PatentsView API has been shut down (HTTP 410 Gone). Prior art search no longer silently fails when no USPTO key is configured — it now throws a clear error directing users to add a USPTO Open Data Portal API key in Settings.

### Added
- **Feasibility pipeline E2E tests** — 6 new Playwright tests exercise the full pipeline flow (form → cost modal → streaming → stage progression → report rendering) using route interception to mock the SSE stream without calling the real Anthropic API. Tests cover: full 6-stage run, stage progression, error handling, connection-lost recovery, no-API-key blocking, and cost cap warnings.
- **AI-assisted claim drafting** — new Python + LangGraph service with 3 AI agents (Planner, Writer, Examiner) that generates patent claim drafts from feasibility analysis and prior art
- **Three independent claims** — broad (method), medium (system), and narrow (apparatus/CRM) scope, informed by prior art avoidance analysis
- **Dependent claims** — hierarchical claims derived from each independent, capped at 20 total (USPTO fee boundary)
- **Examiner review cycle** — AI examiner critiques claims for §101/§102/§103/§112 issues; Writer revises based on feedback
- **Claims tab in UI** — 5 states (no analysis, ready, generating, complete, error) with editable claim text, collapsible strategy/feedback sections
- **UPL acknowledgment modal** — per-project checkbox acknowledgment required before generating claims, stronger than feasibility clickwrap
- **"DRAFT — NOT FOR FILING" watermark** — on every claim in UI display
- **Claim text parser** — extracts structured claims from AI output with independent/dependent/scope/statutory type detection
- **4 prompt templates** (CC BY-SA 4.0) — planner.md, writer.md, examiner.md, common-rules.md with UPL guardrails
- **Claim editing** — click any claim to edit text inline, save to database
- **Planner strategy viewer** — collapsible section showing the AI's claim strategy reasoning
- **Examiner feedback viewer** — collapsible section showing per-claim critique
- **Backend claim-draft module** — POST/GET/PUT API endpoints, Prisma ClaimDraft + Claim models with new fields
- **40 Python tests** (pytest) — models, parser, graph structure, routing, all 3 agents with mocked Anthropic calls

### Fixed
- **Cost cap enforced server-side** (#1) — `costCapUsd` is now checked before starting feasibility runs and claim drafting. Mid-pipeline enforcement: `patchStage` returns `costCapExceeded` flag so the frontend cancels the pipeline when cumulative cost exceeds the cap. Claim drafter agents now track per-call cost.
- **Internal service authentication** (#2) — feasibility and claim-drafter services require `INTERNAL_SERVICE_SECRET` header. Frontend no longer calls the feasibility service directly — SSE streams are proxied through the backend. Docker Compose no longer exposes internal service ports (3001, 3002) to the host.
- **API key removed from frontend requests** (#3) — the Anthropic API key is no longer sent from the browser in pipeline request bodies. The backend SSE proxy injects it server-side from encrypted settings. Claim drafter prefers `ANTHROPIC_API_KEY` env var. GraphState scrubs the key after all agents finish.
- **Path traversal prevention** (#4) — `resolveExportDir` validates that custom export paths resolve within `os.homedir()`. Rejects `../../../etc` traversal attempts with an actionable error.
- **HTML injection prevention** (#5) — exported HTML report title is now escaped with `htmlEscape()` before interpolation into `<title>` tag.
- **Claim edit ownership check** (#6) — `updateClaim` verifies the claim belongs to the project via a join through `ClaimDraft` before allowing the update. `UpdateClaimDto` with `@MaxLength(10000)` prevents oversized writes.
- **Concurrent draft guard** (#7) — `startDraft` checks for an existing RUNNING draft before creating a new one. Returns 409 Conflict to prevent multiple concurrent Claude sessions.
- **Stuck draft cleanup on startup** (#8) — `ClaimDraftService.onModuleInit` marks any RUNNING drafts from a previous crash as ERROR, preventing permanently stuck drafts.
- **Structured examiner verdict** (#9) — examiner agent now requests a JSON verdict block instead of relying on fragile `REVISION_NEEDED: YES` string matching. Parser tries JSON code block, raw JSON, old sentinel, and defaults to false.
- **Timing-safe token comparison** (#10) — `AuthGuard` uses `crypto.timingSafeEqual` instead of direct string comparison to prevent timing side-channel attacks.
- **Per-installation encryption salt** (#11) — PBKDF2 salt stored in the `AppSettings.encryptionSalt` database column (generated on first run), replacing the hardcoded constant. Salt travels with the database on backup/restore.
- **No silent model defaults** (#12) — removed inconsistent model fallbacks across three services. Feasibility service returns 400 if model is missing. Prisma default is empty string. Frontend requires explicit model selection before running analysis.
- **LangGraph dict/Pydantic crash** — `run_claim_pipeline` now handles dict state from LangGraph's `astream` correctly, fixing a crash on every real pipeline call.
- **Claim-drafter added to CI** (#13) — pytest job runs on every push/PR; build job verifies pip install.
- **Playwright E2E added to CI** (#14) — browser tests run against the full stack on every push/PR, with artifact upload on failure.
- **DTO validation for startRun and rerunFromStage** (#15) — `StartRunDto` caps narrative at 50K chars, `RerunFromStageDto` validates stage number 1-6.
- **Prior art context size limits** (#16) — `ClaimDraftRequest` caps `prior_art_results` at 20 items, all text fields have `max_length` constraints, built context string capped at 50K chars.
- **Per-agent timeout in claim-drafter** (#17) — each agent's `messages.create` call has `timeout=120.0` seconds, preventing a single slow Anthropic response from blocking the pipeline indefinitely.
- **Typed request body for callClaimDrafter** (#18) — `requestBody: any` replaced with `ClaimDraftRequestBody` interface that mirrors the Python `ClaimDraftRequest` Pydantic model. Field name mismatches are now caught at compile time.
- **Internal service ports not exposed in Docker** (#19) — confirmed fixed in #2. Only backend (3000) and frontend (8080) are reachable from the host.
- **ODP scoring bias correction** (#20) — prior art results without abstracts (common with ODP) now receive a 1.5x title-score multiplier to compensate for the missing abstract dimension. Prevents systematic underscoring of ODP results vs PatentsView results.
- **/draft/sync bypassed resolve_api_key()** (NEW-A) — the sync endpoint now correctly uses `resolve_api_key()` to prefer the env var. Docker Compose passes `ANTHROPIC_API_KEY` to the claim-drafter container.
- **Postgres port removed from Docker Compose** (NEW-B) — `5432:5432` was published externally with hardcoded credentials. Removed.
- **on_step callback no longer receives full state dict** (NEW-C) — passes only `(node_name, step)` strings, not the GraphState containing the API key.
- **Pydantic v2 list validation** (NEW-D) — `max_length` on `Field()` for lists is silently ignored in Pydantic v2. Replaced with `@field_validator` that raises on >20 items.
- **INTERNAL_SERVICE_SECRET default documented** (NEW-E) — README now warns that the Docker default is a known public value and provides an `openssl rand` command to generate a custom secret.
- **callClaimDrafter finally block** (#8 residual) — draft status is now guaranteed to resolve via a `finally` block, even if the error handler's Prisma update itself fails.

### Security
- All claim drafting prompts licensed CC BY-SA 4.0 (disclaimers survive forks)
- Per-project UPL acknowledgment with checkbox before claim generation
- "DRAFT — NOT FOR FILING" watermark on all claim displays
- Internal services authenticated via shared secret (`INTERNAL_SERVICE_SECRET`)
- API key never sent from browser — injected server-side
- API keys encrypted at rest with per-installation random salt
- Timing-safe Bearer token comparison
- Path traversal prevention in export path
- HTML injection prevention in report exports
- Claim edit ownership verification

## [0.3.4] - 2026-03-31

### Added
- **Prior art scoring improvements** — stop-word filtering (50+ common patent terms like "comprising", "wherein", "apparatus"), title-match weighting (2x over abstract), and per-term frequency scoring. Reduces noise from common technical language.
- **Prompt file integrity checking** — SHA-256 hashes computed on first load, logged to console, and exposed on `/health` endpoint. Warns on drift if prompt files are modified while the service is running.
- **API key encryption at rest** — Anthropic and USPTO API keys are now encrypted with AES-256-GCM using a machine-derived key (hostname + platform + username) before storage in SQLite. Plaintext keys never hit disk. Backward-compatible with existing unencrypted values.
- **GitHub Actions CI** — automated test pipeline runs backend (Jest) and frontend (Vitest) tests plus a full build check on every push and PR to master
- **Optional Bearer token auth** — set `PATENTFORGE_TOKEN` environment variable to require `Authorization: Bearer <token>` on all API requests. Disabled by default for backward compatibility with single-user deployments.
- **191 automated tests** — 139 backend (Jest, incl. 22 doc/version audit) + 31 frontend (Vitest) + 21 E2E (Playwright)

### Security
- API keys encrypted at rest with AES-256-GCM (machine-derived key)
- Optional authentication guard for LAN/network deployments

## [0.3.3] - 2026-03-31

### Added
- **Playwright E2E test suite** — 12 browser tests covering navigation, project lifecycle, invention form, settings, and prior art panel states. Tests run against live services with Chromium.
- **DOCX parser improvements** — italic (`*text*`, `_text_`), inline code (`` `code` ``), numbered lists (`1.`, `2.`), and nested bullets now render correctly in Word exports
- **17 new DOCX parser unit tests** — comprehensive coverage of all markdown-to-DOCX formatting
- **PatchRunDto** — typed DTO with class-validator decorators for the feasibility run patch endpoint
- **139 automated tests** — 96 backend (Jest) + 31 frontend (Vitest) + 12 E2E (Playwright)

### Fixed
- **Type safety**: replaced `any`-typed update objects in `patchStage` and `patchRun` with proper `Prisma.FeasibilityStageUpdateInput` / `Prisma.FeasibilityRunUpdateInput` types. Removed `as any` cast in controller.
- **Interleaved-thinking header**: no longer sent on Haiku model requests (only Sonnet/Opus). Prevents sending an unsupported beta feature header to models that ignore it.
- **CORS restriction**: feasibility service now only accepts requests from `localhost:3000` (the backend), not all origins
- **Cleanroom E2E**: fixed `grep -P` incompatibility on Windows, fixed dev.db path detection

### Security
- Feasibility service CORS locked to backend origin only (`localhost:3000`, `127.0.0.1:3000`)

## [0.3.2] - 2026-03-31

### Added
- **Lazy-load patent claims from USPTO** — when you expand the Claims section in the Patent Detail drawer and have a USPTO API key configured, PatentForge now fetches the actual patent claims text from the ODP Documents API
- **ODP Documents API client** — fetches the file wrapper documents list, finds the most recent CLM (Claims) XML document, downloads and extracts the tar archive, and parses ST96 XML to extract active (non-canceled) claims
- **Claims loading spinner** — shows a spinner with "Loading claims from USPTO..." while fetching, gracefully falls back to "View on Google Patents" link on error or when no key is configured
- **Claims caching** — once fetched, claims are cached locally and reused on subsequent views without additional API calls
- **110 automated tests** — 79 backend (Jest) + 31 frontend (Vitest), up from 86 in v0.3.1

### Changed
- Claims section in Patent Detail drawer is now lazy-loaded on-demand rather than fetched with initial patent detail (reduces API calls — user's key, user's quota)
- `getClaims` API endpoint now fetches from ODP Documents API when cached claims are unavailable and a USPTO key is configured

## [0.3.1] - 2026-03-31

### Added
- **USPTO Open Data Portal integration** — replaces the shut-down PatentsView API with the new ODP API at data.uspto.gov for prior art search and patent detail enrichment
- **USPTO API key in Settings** — optional BYOK field for the ODP API key; everything works without it (AI web search still handles prior art in Stage 2)
- **ODP search client** — sequential queries with rate limit compliance (burst=1, 1.5s delays, 10s backoff on 429)
- **ODP enrichment client** — fetches patent metadata (title, dates, inventors, assignees, CPC codes) by patent number
- **86 automated tests** — 59 backend (Jest) + 27 frontend (Vitest), up from 62 in v0.3.0

### Changed
- Prior art panel error state now shows a helpful "add a USPTO API key" message instead of "PatentsView shut down" error
- Patent detail drawer error state similarly updated with actionable guidance
- Source label on prior art results shows "USPTO Open Data Portal" when ODP is the data source

### Fixed
- Missing Prisma migration for `exportPath` and `costCapUsd` columns (Settings 500 on fresh install)
- Feasibility build script didn't copy `.md` prompt files to `dist/` (pipeline crash on fresh install)
- Unhandled `AbortError` crashed feasibility service when client disconnected mid-pipeline
- `@nestjs/testing` v11 conflicted with `@nestjs/common` v10 peer dependency

## [0.3.0] - 2026-03-31

### Added
- **USPTO patent detail enrichment** — click any prior art result to see a slide-out drawer with full patent data: filing date, grant date, assignee(s), inventor(s), CPC classifications, patent type, abstract, and full claims text
- **PatentDetail cache** — enriched patent data is cached locally for 30 days (granted patents don't change), reducing API calls on repeat views
- **Individual stage re-run** — re-run any completed stage and its downstream dependents without restarting the entire pipeline; creates a new versioned run preserving full audit trail
- **Prior art CSV export** — download prior art search results as a spreadsheet with enriched data (dates, assignees, CPC codes) when available
- **Patent detail API** — new `GET /api/patents/:patentNumber` and `GET /api/patents/:patentNumber/claims` endpoints with automatic PatentsView enrichment

### Changed
- Prior art result cards are now clickable (open patent detail drawer)
- Stage progress sidebar shows "re-run" button on completed stages when pipeline is idle
- Prior art panel header includes "Export CSV" button when search is complete
- PatentsView migration error now detected and surfaced with clear user message and link to USPTO ODP

### Known Issues
- **PatentsView API shut down** — The USPTO PatentsView API was shut down on March 20, 2026 as part of the migration to the [USPTO Open Data Portal](https://data.uspto.gov/). Prior art search via PatentsView and patent detail enrichment are temporarily unavailable. The AI analysis pipeline (Stages 1-6) still works — Stage 2 uses Anthropic web search for prior art research. Full ODP integration is planned for v0.3.1.

## [0.2.2] - 2026-03-30

### Changed
- **Prompt role language** — all 6 stage prompts now identify the AI as a "patent landscape research assistant" instead of role-playing as a patent attorney; each prompt includes explicit "not a lawyer" and "not legal advice" disclaimers
- **Embedded per-stage disclaimer** — common-rules.md now instructs the AI to begin every stage output with an italic disclaimer notice (survives copy-paste of individual stages)
- **Section titles softened** — "File or Don't File" → "Filing Indicators", "Bottom-Line Recommendation" → "Overall Assessment", "Examiner Rejection Simulation" → "Anticipated Examiner Concerns"
- **Assessment labels revised** — "FILE NOW" / "DO NOT PURSUE PATENT" replaced with evidence-framed labels ("INDICATORS FAVOR FILING" / "INDICATORS SUGGEST NOT FILING")
- **Stage 6 closing disclaimer strengthened** — now explicitly states "The author of this tool is not a lawyer" and "The AI system that generated this analysis is not a lawyer", warns about hallucinated references
- **Report exporter hardcoded disclaimer** — HTML export now includes a styled disclaimer footer outside the AI-generated content div (survives truncation)
- **All disclaimer watermarks updated** — HTML export, Word (.docx) export, on-screen report viewer, and frontend HTML download all use the stronger disclaimer language
- **README subtitle** — changed from "patent research and preparation tool" to "patent landscape research tool" with prominent blockquote disclaimer
- **Landing page** — updated disclaimer section with stronger language and link to LEGAL_NOTICE.md
- **User manual** — updated disclaimers, stage descriptions, and closing notice

### Added
- **LEGAL_NOTICE.md** — standalone legal notice file covering what PatentForge is and is not, user responsibilities, and derivative work requirements
- **LICENSE-PROMPTS** — CC BY-SA 4.0 license for prompt content (ensures disclaimers survive forks via ShareAlike requirement)
- **Dual license structure** — MIT for code, CC BY-SA 4.0 for prompts; README license section updated accordingly

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
