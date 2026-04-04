# v0.8 UI Polish Batch — Design Spec

**Date:** 2026-04-04
**Scope:** 3 backlog items (#5, #7, #8) plus sidebar/mobile UX fixes discovered during live UI audit.

**Live UI audit findings (2026-04-04):** Ran the full stack (backend + frontend), created a project, filled the invention form, and walked through every page. Screenshots captured at desktop (1280x900) and mobile (375x812). Key findings incorporated into this spec.

---

## #5 — ProjectDetail.tsx Decomposition + Sidebar Polish

**Problem:** ProjectDetail.tsx is 1,485 lines with 28 state variables, 10 handler functions, and 11 conditional render blocks. Too large to reason about, test in isolation, or change safely. Additionally, the live UI audit revealed:
- Sidebar stage names truncate badly ("Technical Intak...", "Patentability A...", "Comprehensiv...")
- On mobile, the sidebar takes full viewport width and pushes main content below the fold — user must scroll past the entire pipeline section to see any content
- Description text truncates at certain viewport widths

**Design — Extraction plan (6 new files):**

### `frontend/src/hooks/useFeasibilityRun.ts`
Extracts: All SSE streaming state and handlers (~400 lines)
- State: `stages`, `activeStageNum`, `currentStageName`, `streamText`, `isStreamComplete`, `runError`, `cancelling`, `abortRef`, `runIdRef`
- Handlers: `handleRunFeasibility()`, `handleResume()`, `proceedWithRun()`, `handleCancel()`
- Constants: `WEB_SEARCH_COST_PER_SEARCH`, `ESTIMATED_SEARCHES_PER_RUN`, `COST_BUFFER`, `estimateRunCosts()`
- Returns: all state + handlers needed by the parent component
- Input: `projectId`, `project`, `settings` (for model/cap), callbacks for `setViewMode`, `setToast`, `setCostModal`, `loadProject`

### `frontend/src/hooks/useRunHistory.ts`
Extracts: Run history state and handlers (~80 lines)
- State: `runHistory`, `selectedRunVersion`, `historicalReport`
- Handlers: `handleShowHistory()`, `handleLoadHistoricalRun()`
- Input: `projectId`, callbacks for `setViewMode`

### `frontend/src/hooks/useProjectDetail.ts`
Extracts: Project loading and initial view mode selection (~80 lines)
- State: `project`, `loading`, `error`, `priorArtSearch`, `claimDraftStatus`
- Handler: `loadProject()` (useCallback)
- Effects: load on mount, abort on cleanup, fetch claim status on tab switch
- Input: `id` (from URL params)

### `frontend/src/components/ProjectSidebar.tsx`
Extracts: The entire `<aside>` sidebar (~220 lines)
- Receives: project, stages, viewMode, action handlers, status data (prior art, claims, compliance, application) as props
- **Fixes sidebar truncation:** Uses `min-w-[240px]` and `w-64` instead of being squeezed. Stage names render in full.
- **Fixes mobile layout:** On screens <768px, the sidebar renders as a collapsible section or compact horizontal nav — not a full-width column that pushes content below the fold. Uses a disclosure/accordion pattern: collapsed by default on mobile showing only "Pipeline" and "Actions" headers, expandable with a tap. This keeps the main content immediately visible on mobile without losing access to navigation.
- Includes status badges for #7 (see below)

### `frontend/src/components/ProjectOverview.tsx`
Extracts: The overview viewMode render block (~100 lines)
- Receives: project, invention, latestRun, handlers as props
- Renders: invention summary card, run status cards (COMPLETE/ERROR/CANCELLED), empty state, edit/run buttons

### `frontend/src/components/RunHistoryView.tsx`
Extracts: The history viewMode render block (~70 lines)
- Receives: runHistory, handlers as props
- Renders: historical run cards with View Report / Re-run actions (including the #10 work from Ship First batch)

**ProjectDetail.tsx after decomposition:** ~500-600 lines. Remains the coordinator — owns `viewMode` dispatch, renders the layout shell (breadcrumb + sidebar + main content area), delegates to extracted components and hooks. Still has: `costModal`, `toast`, `selectedStage`, `drawerPatent`, `fullReportContent`, `reportHtml` state (these are tightly coupled to the view coordination and not worth extracting).

**Testing:**
- Each extracted hook gets unit tests (mock API, verify state transitions)
- `ProjectSidebar` gets render tests (verify badge rendering, active state, mobile behavior)
- Existing 83 frontend tests must still pass
- Browser QA mandatory per CLAUDE.md rule 4: every rendered state at desktop and mobile

---

## #7 — Sidebar Nav Status Badges

**Problem:** Prior Art, Claims, Compliance, Application buttons are identical gray rectangles. User has no idea which pipeline steps are done, running, or not started. Confirmed in live UI audit — all four buttons are visually identical.

**Design:** Implemented as part of the new `ProjectSidebar` component from #5. Each action button gets a status indicator:

| State | Visual | CSS |
|-------|--------|-----|
| Not started | No badge (default gray button) | — |
| Running | Animated spinner dot | `animate-spin` with small spinner icon |
| Complete | Green dot | `bg-green-500 rounded-full w-2 h-2` |
| Error | Red dot | `bg-red-500 rounded-full w-2 h-2` |
| Complete + count | Green dot + count badge | `bg-green-900 text-green-300 text-xs px-1.5 rounded-full` |

**Data source for each button:**
- **Prior Art:** `priorArtSearch` state (already loaded in `loadProject`). Complete if `priorArtSearch?.status === 'COMPLETE'`. Count: `priorArtSearch?.results?.length`. Already has a count badge in current code — keep and improve it.
- **Claims:** `claimDraftStatus` state (already loaded). Complete if `claimDraftStatus?.status === 'COMPLETE'`. Count: `claimDraftStatus?.claims?.length`.
- **Compliance:** Need to add `complianceStatus` state — fetch from `api.compliance.getLatest(projectId)` during `loadProject`. Complete if `status === 'COMPLETE'`.
- **Application:** Need to add `applicationStatus` state — fetch from `api.application.getLatest(projectId)` during `loadProject`. Complete if `status === 'COMPLETE'`.

**Note:** Two new API calls in `loadProject` for compliance and application status. These are lightweight GET requests that return a status object. They run in parallel with the existing prior art and claim draft status fetches using `.then().catch(() => {})` pattern (same as existing calls).

**Acceptance criteria:**
- Status dots visible on Claims, Compliance, and Application buttons
- Consistent with Prior Art's existing badge pattern
- Running state shows spinner
- Complete state shows green dot (+ count where applicable)
- Error state shows red dot

---

## #8 — Sticky Cancel Button During Streaming

**Problem:** During long pipeline stages, the cancel button might scroll out of view.

**Current state from live audit + code review:** The cancel button is in the header bar above `StreamingOutput`. StreamingOutput has `max-h-[500px] overflow-y-auto` — content scrolls internally, and the header (with cancel button) stays in normal document flow above it. This means the cancel button likely stays visible because only the output area scrolls, not the page.

**Design — Verify and fix if needed:**
1. During implementation, simulate long streaming content (inject text into StreamingOutput) and verify scroll behavior
2. If cancel button stays visible: close item, document as already-working
3. If cancel button scrolls off: add `sticky top-0 z-10 bg-gray-900` to the running view header bar (1-line CSS change)

**Acceptance criteria:**
- Cancel button is visible during streaming regardless of output length
- Verified with actual long content in the browser (not just code review)

---

## Bug Fix — Backend Build Path

**Already fixed and committed** (commit `3267314`). Added missing `backend/tsconfig.build.json` that caused `nest build` to output to `dist/src/main.js` instead of `dist/main.js`. This broke `npm run start` and `PatentForge.bat`.

---

## Cross-cutting

- All three backlog items (#5, #7, #8) touch frontend components — browser QA mandatory for all
- The decomposition (#5) is the foundation — #7 badges are built into the extracted `ProjectSidebar`, not retrofitted to the old monolith
- Recommended task order: extract hooks first → extract components (including sidebar with badges) → verify sticky cancel → browser QA
- Existing 83 frontend tests + 234 backend tests + 19 integration tests must still pass
- No version bump or doc updates until v0.8 is complete
