# PatentForge v1.0.0 Roadmap — Design Spec

**Date:** 2026-04-07
**Baseline:** v0.9.0 (commit 93fa34f, 628 tests, cleanroom E2E 28/28 PASS)
**Source:** Review Team Handoff Report, reordered per dev team discussion

---

## Release Strategy

Four sprints, each producing a tagged release:

| Sprint | Version | Focus |
|--------|---------|-------|
| S1 | v0.9.1 | Prompt sync + legal posture alignment |
| S2 | v0.9.2 | SSE progress + cross_references + claims lazy-load |
| S3 | v0.9.3 | NestJS v11 + Vite v8 + retry/backoff + API key encryption |
| S4 | v1.0.0 | Polish + QA hardening + final release |

---

## Sprint 1: v0.9.1 — Prompt Sync & Legal Posture

### S1-1: Assessment label alignment
- **Files:** `services/feasibility/src/prompts/stage-4.md`, `stage-5.md`, `stage-6.md`
- **Change:** Replace current labels with v1.2.0 labels:
  - INDICATORS FAVOR FILING → LANDSCAPE FAVORS FILING
  - GATHER MORE EVIDENCE → MORE DOCUMENTATION WOULD STRENGTHEN POSITION
  - CONSIDER TRADE SECRET → KEEP AS TRADE SECRET
  - INDICATORS SUGGEST NOT FILING → SIGNIFICANT OBSTACLES IDENTIFIED
  - CONSIDER DESIGN PATENT ONLY → DESIGN PATENT AVENUE WORTH EXPLORING
- **Blast radius:** Zero code changes — labels are unstructured text in AI output

### S1-2: Legal posture update to all services' common-rules.md
- **Files:** `services/*/src/prompts/common-rules.md` (4 files)
- **Change:** Update disclaimer text to v1.2.0 version (adds "hallucinated references" warning, "fabricated patent numbers, inaccurate legal citations" specifics)
- **Source of truth:** patent-analyzer-app PromptTemplates.cs CommonRules section

### S1-3: 50-word minimum input validation
- **Files:** `frontend/src/pages/InventionForm.tsx` (client-side), `backend/src/projects/projects.controller.ts` or invention endpoint (server-side)
- **Change:** Block pipeline start when invention description < 50 words. Client: inline validation message. Server: 400 response with actionable error.
- **Prompt already has it:** stage-1.md line 16 already instructs the AI to ask for more detail. This adds programmatic enforcement.

### S1-4: Documentation updates
- CHANGELOG.md, DISCUSSIONS-SEED.md references to old labels

---

## Sprint 2: v0.9.2 — UX Completion

### S2-1: SSE progress events for Python services
- **Files:** claim-drafter, compliance-checker, application-generator server.py files + backend polling → SSE + frontend hooks
- **Pattern:** Port from feasibility service's existing SSE implementation
- **Target UX:** "Generating claim 12 of 37..." / "Running rule 3 of 4: enablement check..."

### S2-2: Populate cross_references field
- **Files:** application-generator graph.py, models.py
- **Change:** Populate from project context (invention narrative + claims) — template fill, not new LLM call

### S2-3: Backend claims lazy-load
- **Files:** Backend claims endpoint + ClaimsTab.tsx
- **Change:** Send preview text initially, full content on expand

---

## Sprint 3: v0.9.3 — Security & Dependency Hardening

### S3-1: NestJS v11 migration (GitHub Issue #18)
### S3-2: Vite v8 upgrade
### S3-3: API key encryption at rest
### S3-4: Standardize retry/backoff across all service-to-service calls

---

## Sprint 4: v1.0.0 — Polish & Release

### S4-1: Settings save floating toast
### S4-2: Prior art result count configuration
### S4-3: Mobile/responsive Playwright tests
### S4-4: astream loop state integrity assertion
### S4-5: Three-repo documentation sync
### S4-6: Final cleanroom E2E + verify-release + release gate
