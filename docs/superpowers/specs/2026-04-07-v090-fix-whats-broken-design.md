# PatentForge v0.9.0 — Fix What's Broken

**Date:** 2026-04-07
**Status:** Design approved
**Theme:** First post-announcement release. Real users are trying the product. Fix what's visibly broken.

---

## Scope

Four fixes + five E2E coverage additions. No new features.

### Fixes

1. **APP-SECTIONS** — Application tab's 9-section structured navigation works end-to-end
2. **NO-PROGRESS quick fix** — Elapsed timer + guidance copy on Claims/Compliance/Application spinners
3. **Download verification** — All export buttons verified working in Chrome, Playwright tests added
4. **Streaming scrollbar** — Horizontal overflow during Stage 2 eliminated

### E2E Coverage Additions

1. Multiple projects (create, list, delete cascade, switch)
2. Cancel mid-pipeline (cancel at Stage 2, verify clean state)
3. Resume from failed stage (simulate failure, resume, verify completion)
4. Edit invention after feasibility (change field, verify no breakage)
5. Save draft → close → restart → run from saved draft

### Out of Scope

- Full SSE progress events from Python services (v0.9.1)
- Settings save floating toast (v0.9.1)
- Mobile/responsive verification (v0.9.1)
- Claims lazy-load / response size optimization (v0.9.1)
- Prior art result count configurability (v0.9.1)
- NestJS v11 migration (v0.10.0)
- Vite v8 upgrade (v0.10.0)
- Deprecated dependency cleanup (v0.10.0)

### Success Criteria

- All four fixes verified in browser with evidence
- All five E2E scenarios pass in Playwright
- Any bugs uncovered by E2E scenarios are fixed before ship
- `verify-release.sh` passes 36/36
- Full release checklist completed with evidence

---

## Fix 1: APP-SECTIONS

### Problem

The Application tab has full 9-section structured UI — sidebar navigation with named sections (title, background, summary, detailed description, claims, abstract, figure descriptions, cross references, IDS table), per-section content display, per-section editing, and per-section export. None of it works. Every generation completes "successfully" but `sections: []` is always empty. The frontend degrades to a red warning banner: "Application generated but all sections are empty."

### Root Cause Analysis

The data flow was traced end-to-end:

- **Python service (working):** `ApplicationGenerateResult` model has all 9 section fields. Each LangGraph agent (background, summary, detailed_description, abstract, figures) mutates `GraphState` correctly. `run_application_pipeline()` builds the result from `state_dict` at `graph.py` lines 133-147.
- **Backend mapping (correct on paper):** `application.service.ts` lines 362-378 map snake_case fields to camelCase with `?? null` fallback. The field translations are correct.
- **Frontend (ready):** `ApplicationTab.tsx` filters populated sections, renders sidebar nav, supports editing and export. Works correctly when sections contain data.

The bug is in the data flow between the Python service output and the database write. Two candidates identified:

### Diagnostic Step (Do This First)

Add a log line to `callApplicationGenerator()` in `application.service.ts` immediately before the Prisma update:

```typescript
console.log('[Application] Generator response sections:', {
  background: result.background?.length,
  summary: result.summary?.length,
  detailed_description: result.detailed_description?.length,
  abstract: result.abstract?.length,
  claims: result.claims?.length,
  figure_descriptions: result.figure_descriptions?.length,
  cross_references: result.cross_references?.length,
  ids_table: result.ids_table?.length,
  title: result.title?.length,
});
```

Run a real Application generation. The log output determines which fix applies.

### Candidate A — Python State Accumulation Bug

**Trigger:** All section lengths are 0 in the diagnostic log.

**Cause:** In `graph.py`, the `astream` loop tracks state in a local `state_dict` variable. Each node yields its output, and the loop does:

```python
if isinstance(node_state, dict):
    state_dict = node_state  # REPLACES entire state_dict
```

When `format_ids` returns `{"step": "format_ids"}` (a partial dict), all previously accumulated content from background/summary/detailed_description agents is wiped. The `finalize` node runs on LangGraph's correct internal state, but `state_dict` only contains whatever `finalize` explicitly returned.

**Fix:** Change `state_dict = node_state` to `state_dict.update(node_state)` so node outputs merge into accumulated state instead of replacing it. ~10 lines in `services/application-generator/src/graph.py`.

**File:** `services/application-generator/src/graph.py`

### Candidate B — Backend Serialization Issue

**Trigger:** Section lengths are non-zero in the diagnostic log, but DB still shows nulls/empty.

**Cause:** Something in the HTTP response parsing, JSON deserialization, or field mapping drops the section values before the Prisma write. Most likely a snake_case/camelCase mismatch where `result.detailed_description` arrives as `result.detailedDescription` (or vice versa), causing the `?? null` fallback to fire on `undefined`.

**Fix:** Trace the exact field name mismatch and correct the mapping. ~5 lines in `backend/src/application/application.service.ts`.

**File:** `backend/src/application/application.service.ts`

### Verification

After applying the fix (whichever candidate):
1. Run a full Application generation
2. Confirm all 9 sections appear in the ApplicationTab sidebar
3. Click each section — content renders with real generated text
4. Edit one section, save, reload — edit persists
5. Export Word doc — all 9 sections present in the document
6. Export HTML — all 9 sections present
7. Browser console clean — no errors or warnings

---

## Fix 2: NO-PROGRESS Quick Fix

### Problem

Claims, Compliance, and Application generation show a static spinner for 3-7 minutes with zero feedback. No heartbeat, no elapsed time, no indication the service is alive. Users cannot distinguish "processing" from "crashed." The elapsed timer that already exists only appears after completion — useless during the wait.

### Solution

Frontend-only changes. Two additions to each spinning state:

**1. Elapsed timer on the spinner:** "Running... 2m 34s" that ticks every second from the moment generation starts. Minimum signal that the process is alive.

**2. Guidance copy below the spinner:**
- Claims: "Generating claims typically takes 3-5 minutes. The AI is planning, drafting, and reviewing your claims."
- Compliance: "Compliance checking typically takes 5-8 minutes. Each claim is being validated against patent law requirements."
- Application: "Application generation typically takes 2-4 minutes. Your patent application document is being assembled."

### What This Does NOT Do

No backend changes. No SSE events. No step-by-step progress. The spinner still spins — but now it has a ticking clock and context. Full SSE progress events are deferred to v0.9.1.

### Implementation

Create a shared `useElapsedTimer` hook (or inline `useState` + `useEffect` with `setInterval`) that:
- Starts when generation begins (status transitions to RUNNING or equivalent)
- Displays formatted elapsed time (Xm Ys) alongside the existing spinner
- Stops when generation completes, errors, or is cancelled
- Cleans up interval on unmount

Add the hook + guidance copy to each tab's loading state.

### Files

- `frontend/src/hooks/useElapsedTimer.ts` (new, shared hook)
- `frontend/src/components/ClaimsTab.tsx`
- `frontend/src/components/ComplianceTab.tsx`
- `frontend/src/components/ApplicationTab.tsx`

### Verification

For each of Claims, Compliance, and Application:
1. Start generation
2. Confirm timer appears immediately and ticks every second
3. Confirm guidance copy is visible and service-specific
4. Wait for completion — timer stops, results render normally
5. Trigger an error — timer stops, error message renders
6. Cancel (if applicable) — timer stops, cancelled state renders
7. Browser console clean

---

## Fix 3: Download Verification

### Problem

Every export button in the product (HTML reports, Word documents) has only been tested via `curl` — confirming 200 status and correct file size. The actual browser download experience (click button → browser download notification → file in Downloads folder → file opens correctly) has never been verified.

### Buttons to Verify

| Tab | Button | Expected file |
|-----|--------|---------------|
| Feasibility | Export HTML | HTML report with dark theme CSS |
| Feasibility | Export Word | .docx with 6-stage analysis |
| Claims | Export Word | .docx with claim drafts |
| Compliance | Export Word | .docx with compliance results |
| Application | Export HTML | HTML report with all sections |
| Application | Export Word | .docx with full patent application |

### Process

For each button:
1. Click in Chrome
2. Confirm browser download notification/dialog appears
3. Confirm file lands in Downloads folder
4. Open file — confirm content is present, correctly formatted, not empty or corrupted

### If Any Button Fails

Most likely failure modes:
- Blob URL construction issue (works in fetch, fails in browser download)
- Content-Disposition header missing or malformed
- MIME type incorrect causing browser to display instead of download

Diagnose via browser DevTools Network tab and fix.

### After Verification

Add Playwright E2E tests that click each download button and assert a file was downloaded with non-zero size. This closes the gap permanently.

### Files (if fixes needed)

- `frontend/src/components/FeasibilityView.tsx` (export handlers)
- `frontend/src/components/ClaimsTab.tsx` (export handler)
- `frontend/src/components/ComplianceTab.tsx` (export handler)
- `frontend/src/components/ApplicationTab.tsx` (export handlers)
- Backend export endpoints if Content-Disposition or MIME issues

---

## Fix 4: Streaming Scrollbar

### Problem

During Stage 2 feasibility streaming, long patent URLs in the output cause horizontal overflow. A scrollbar appears and jitters as content streams in.

### Fix

Add `overflow-wrap: break-word` (Tailwind: `break-words`) to the streaming content container. This wraps long unbroken strings (URLs) at the container edge while keeping them readable. One CSS class addition.

If `break-words` causes layout issues with other content in the same container, fall back to `overflow-x: hidden` (Tailwind: `overflow-x-hidden`) which clips the overflow entirely.

### File

The streaming output container — likely in `FeasibilityView.tsx` or the shared `StreamingOutput.tsx` component. Identify exact element during implementation.

### Verification

1. Run a feasibility analysis
2. Watch Stage 2 stream (typically contains long USPTO/patent URLs)
3. Confirm no horizontal scrollbar appears
4. Confirm long URLs wrap cleanly without clipping meaningful content
5. Confirm other stages still render correctly

---

## E2E Coverage: 5 New Scenarios

All implemented as Playwright tests in the existing E2E suite. If any scenario uncovers a bug, the bug is fixed before v0.9.0 ships.

### Scenario 1: Multiple Projects

**Steps:**
1. Create 3 projects with distinct titles ("Project Alpha", "Project Beta", "Project Gamma")
2. Verify project list renders all 3 with correct titles and dates
3. Delete the middle project ("Project Beta")
4. Verify list now shows 2 projects, deleted project is gone
5. Verify deleted project's related data (invention, feasibility runs, claims, compliance, application) is cascade-deleted — check via API
6. Navigate into each remaining project — confirm data is intact, no cross-contamination

### Scenario 2: Cancel Mid-Pipeline

**Steps:**
1. Create project, fill invention, start feasibility run
2. Wait for Stage 1 to complete and Stage 2 to begin streaming
3. Click Cancel button
4. Verify run status is CANCELLED in the UI
5. Verify no orphaned RUNNING stages, no stuck spinner
6. Verify a new run can be started on the same project
7. Start new run — verify it begins from Stage 1

### Scenario 3: Resume from Failed Stage

**Steps:**
1. Create project, fill invention, start feasibility run
2. Simulate failure at Stage 3 (kill feasibility service or mock error)
3. Verify run status shows ERROR with failed stage identified in UI
4. Restart feasibility service
5. Click Resume button
6. Verify pipeline resumes from Stage 3 (not Stage 1)
7. Verify Stages 1-2 retain their output (not re-run)
8. Verify pipeline completes successfully through Stage 6

**Implementation note:** Service lifecycle manipulation (stop/start) in Playwright may be fragile. If so, structure this as: the automated test covers everything up to the service manipulation boundary; the service stop/restart and resume verification are documented as manual steps in the test plan with specific commands to run.

### Scenario 4: Edit Invention After Feasibility

**Steps:**
1. Create project, fill invention, run feasibility to completion
2. Navigate to invention form
3. Change the description field (append " — UPDATED")
4. Save the edit
5. Navigate back to feasibility view — results still visible, not wiped
6. Verify project is not in a broken state (no error banners, status is coherent)
7. Verify the updated invention text is saved

**Note:** Whether old feasibility results should be marked stale after an invention edit is a UX decision not addressed in v0.9.0. This test only verifies nothing crashes or corrupts.

### Scenario 5: Save Draft → Close → Restart → Run

**Steps:**
1. Create project, fill all 11 invention form fields, click Save Draft (do not run)
2. Stop all services (simulating app close)
3. Restart all services
4. Navigate to the project
5. Verify invention form is populated with all saved data — every field matches what was entered
6. Click Run Feasibility
7. Verify pipeline starts and completes successfully using the saved draft data

**Implementation note:** Same service lifecycle caveat as Scenario 3. The save/verify portion is fully automatable; the service restart boundary may need manual documentation.

---

## Version Roadmap Context

This spec covers v0.9.0 only. For reference, the agreed roadmap:

| Version | Theme | Key Deliverables |
|---------|-------|-----------------|
| **v0.9.0** | Fix what's broken | APP-SECTIONS, NO-PROGRESS quick fix, download verification, scrollbar, 5 E2E scenarios |
| v0.9.1 | Polish and hardening | Full SSE progress events, floating toast, mobile/responsive, claims lazy-load, prior art config |
| v0.10.0 | Tech debt | NestJS v11, Vite v8, deprecated deps |
| v1.0 | Release readiness | UPL prompt compliance hardening (see below), full lifecycle polish |

### v1.0 — UPL Prompt Compliance Hardening

Analysis of the reference repos (`scottconverse/patent-analyzer-prompts` and `scottconverse/patent-analyzer-app`) identified significant UPL (Unauthorized Practice of Law) compliance gaps in PatentForge's current prompts compared to the proven patterns in the original C# app. The reference repos have battle-tested UPL safeguards that PatentForge needs before v1.0.

**Critical gaps to close (Tier 1):**
1. **Mandatory disclaimer as first line of every stage output** — patent-analyzer-app enforces via CommonRules; PatentForge references in common-rules but doesn't enforce per-output display
2. **Web search unavailability warning (Stage 2)** — explicit STOP + mark all references UNVERIFIED if no web search; PatentForge has no fallback
3. **Prior art verification gate before Stage 3 novelty analysis** — check reference URLs before analysis; PatentForge doesn't validate
4. **Stage 5 Plain-English Summary** — marked CRITICAL and NON-NEGOTIABLE in reference repos; completely missing from PatentForge Stage 5
5. **Compliance-checker role disavowal** — missing explicit "You are NOT a lawyer" language
6. **Legal reference caveat (Stage 3)** — note when legal references are training-data-only

**Important gaps (Tier 2):**
7. Web search benefit note for Stage 4
8. Strengthen per-stage role positioning (each stage gets unique "you are not a lawyer" framing, not just common-rules)
9. LICENSE-PROMPTS file (CC BY-SA 4.0 with mandatory disclaimer retention for derivative works)
10. LEGAL_NOTICE.md aligned with patent-analyzer-app patterns

**Reference files for implementation:**
- `C:\Users\scott\OneDrive\Desktop\Claude\patent-analyzer-prompts\` — all 6 stage prompts + 00-common-rules.md
- `C:\Users\scott\OneDrive\Desktop\Claude\patent-analyzer-app\PatentAnalyzer\PromptTemplates.cs` — embedded CommonRules with mandatory disclaimer
- `C:\Users\scott\OneDrive\Desktop\Claude\patent-analyzer-app\LEGAL_NOTICE.md` — comprehensive legal structure
- `C:\Users\scott\OneDrive\Desktop\Claude\patent-analyzer-app\LICENSE-PROMPTS` — CC BY-SA 4.0 with disclaimer retention clause

This work touches all 6 feasibility stage prompts plus claim-drafter, compliance-checker, and application-generator common-rules. Each modified prompt needs a full pipeline run to verify disclaimers appear correctly. Estimated testing cost: 6+ runs at ~$0.62 each.

---

## Files Summary

### Will be modified
- `services/application-generator/src/graph.py` (APP-SECTIONS, Candidate A)
- `backend/src/application/application.service.ts` (APP-SECTIONS diagnostic + Candidate B)
- `frontend/src/components/ClaimsTab.tsx` (NO-PROGRESS timer)
- `frontend/src/components/ComplianceTab.tsx` (NO-PROGRESS timer)
- `frontend/src/components/ApplicationTab.tsx` (NO-PROGRESS timer)
- `frontend/src/components/FeasibilityView.tsx` or `StreamingOutput.tsx` (scrollbar fix)

### Will be created
- `frontend/src/hooks/useElapsedTimer.ts` (shared elapsed timer hook)
- Playwright E2E test files for 5 new scenarios + download verification tests

### May be modified (if download issues found)
- Frontend export handler components
- Backend export endpoints
