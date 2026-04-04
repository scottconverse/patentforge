# v0.8 Ship First Batch — Design Spec

**Date:** 2026-04-03
**Scope:** 5 backlog items (#6, #9, #10, #11, #12) — small, isolated changes with clear acceptance criteria.

---

## #6 — Remove External Pricing Fetch (Privacy)

**Problem:** `ProjectDetail.tsx` fetches LiteLLM pricing JSON from `raw.githubusercontent.com` on every session. For a self-hosted privacy tool, making outbound requests to a third-party CDN contradicts the "your data stays local" promise.

**Design:**
- Delete `LITELLM_URL`, `PRICING_TTL_MS`, `_pricingCache`, and the `fetchLivePricing()` function from `ProjectDetail.tsx`.
- Extract the existing `_fallbackPricing` map to a new file: `frontend/src/utils/modelPricing.ts` as an exported `MODEL_PRICING` constant.
- Update `estimateRunCosts()` to read from the constant synchronously instead of awaiting a fetch.
- Update pricing values manually with each release (model pricing changes are infrequent).

**Files changed:**
- `frontend/src/utils/modelPricing.ts` — new file, pricing constant
- `frontend/src/pages/ProjectDetail.tsx` — remove fetch logic, import constant

**Acceptance criteria:**
- External fetch to `raw.githubusercontent.com` removed
- Pricing data hardcoded in `modelPricing.ts`
- No outbound network requests from the frontend except to localhost services
- Cost estimation still works correctly using hardcoded values

---

## #12 — Docker Frontend Healthcheck

**Problem:** Docker reports "Started" before nginx is actually serving. Other services (like backend) already have healthchecks.

**Design:**
Add healthcheck to the `frontend` service in `docker-compose.yml`:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080"]
  interval: 10s
  timeout: 5s
  retries: 3
  start_period: 10s
```

**Files changed:**
- `docker-compose.yml` — add healthcheck block to frontend service

**Acceptance criteria:**
- Frontend service in docker-compose.yml has a healthcheck
- `docker compose ps` shows health status for frontend

---

## #9 — Retry Button on Project Error State

**Problem:** When backend returns 404 or 500, the only recovery is "Back to Projects." No retry option.

**Design:**
At the error state render block (`ProjectDetail.tsx` ~line 746), add a "Retry" button that calls `loadProject()`:
- Layout: error message box (unchanged), then a row with two buttons below
- "Retry" — primary blue button (`bg-blue-600`), calls `loadProject()`
- "← Back to Projects" — existing text link, unchanged

**Files changed:**
- `frontend/src/pages/ProjectDetail.tsx` — modify error state render block

**Acceptance criteria:**
- "Retry" button visible alongside "Back to Projects" when project load fails
- Clicking Retry calls `loadProject()` and clears the error on success

---

## #11 — Navbar Active State for Projects

**Problem:** No visual indicator on navbar when viewing project list vs. inside a project. Only Settings has an active state.

**Design:**
In `Layout.tsx`, add a "Projects" nav link in the right-side nav group (before Settings):
- Active when `location.pathname === '/' || location.pathname.startsWith('/projects')`
- Uses the same conditional styling pattern as Settings: `text-blue-400` when active, `text-gray-400 hover:text-gray-200` when inactive
- Settings active detection stays as-is (`location.pathname === '/settings'`)

**Files changed:**
- `frontend/src/components/Layout.tsx` — add Projects nav link with active state

**Acceptance criteria:**
- "Projects" nav item visible in navbar
- Active styling on Projects when at `/` or `/projects/*`
- Active styling on Settings when at `/settings`
- Only one nav item active at a time

---

## #10 — History View Actions for ERROR/CANCELLED Runs

**Problem:** Historical ERROR/CANCELLED run cards show status badge but no action — visually dead. COMPLETE runs show "View Report."

**Design:**
In the run history card render block (`ProjectDetail.tsx` ~line 1196), add actions for non-COMPLETE runs:
- ERROR runs: "Re-run" button (blue, calls `handleRunFeasibility()`) + muted "No report available" label
- CANCELLED runs: same — "Re-run" button + "No report available" label
- COMPLETE runs: unchanged ("View Report" button)

This matches the pattern already used for the latest run's ERROR/CANCELLED state at lines 1071-1086.

**Files changed:**
- `frontend/src/pages/ProjectDetail.tsx` — modify run history card render block

**Acceptance criteria:**
- ERROR/CANCELLED runs show "Re-run" button and "No report available" label
- Clicking "Re-run" starts a new feasibility run
- COMPLETE runs still show "View Report" (unchanged)

---

## Cross-cutting

- All 5 changes are independent — no shared state, no ordering dependencies
- Items #9, #10, #11 touch frontend components → browser QA required before commit
- Item #6 removes a network call → verify no outbound requests after change
- Item #12 is docker-compose only → no browser QA needed
- Tests: #6 needs the existing cost estimation test updated (if any). #9/#10/#11 covered by visual QA. #12 verified by `docker compose ps`.
