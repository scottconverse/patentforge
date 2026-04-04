# v0.8 Core Hardening Batch — Design Spec

**Date:** 2026-04-04
**Scope:** 4 backlog items (#1, #2, #3, #4) — backend integration tests, lint/format enforcement, coverage thresholds, TypeScript strictness rollout.

---

## #1 — Backend API Integration Tests (supertest)

**Problem:** Backend has 20 unit/spec files using NestJS `Test.createTestingModule()` with mocked services. No HTTP-level tests that exercise controllers through actual HTTP requests with guards, pipes, and validation.

**Design:**
- Add `supertest` and `@types/supertest` to backend devDependencies.
- Create integration test files in `backend/test/` (NestJS convention for integration/e2e).
- Each test boots a real NestJS app with an in-memory SQLite database (Prisma already supports SQLite — the backend uses it for local dev).
- Tests cover HTTP-level behavior: status codes, validation errors, guard rejections, response shapes.

**Endpoints to cover:**
- Projects: `POST /projects` (201, 400 missing title), `GET /projects` (200), `GET /projects/:id` (200, 404), `DELETE /projects/:id` (200, 404)
- Invention: `PUT /projects/:id/invention` (200, 404), `GET /projects/:id/invention` (200)
- Settings: `GET /settings` (200 with defaults), `PUT /settings` (200)
- Auth guard: requests without valid header → 401
- Feasibility: `POST /projects/:id/feasibility/run` (201 creates run record)

**Scripts:** Add `test:integration` to backend/package.json.
**CI:** Add integration test step to `.github/workflows/ci.yml` after unit tests.

**Acceptance criteria:**
- `supertest` in devDependencies
- Integration tests exist for projects, invention, settings, auth guard, and one orchestration endpoint
- `npm run test:integration` runs them
- CI runs integration tests

---

## #2 — Lint/Format Scripts + CI Enforcement

**Problem:** No ESLint or Prettier config in backend or frontend. No lint step in CI. Quality rules are social only.

**Design:**

**Backend:**
- Install: `eslint`, `@eslint/js`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `prettier`, `eslint-config-prettier`
- `eslint.config.mjs` — flat config extending `@typescript-eslint/recommended`, with Prettier conflict resolution
- `.prettierrc` — `{ "singleQuote": true, "trailingComma": "all" }` (matches existing code style observed in codebase)
- Scripts in package.json: `lint`, `lint:fix`, `format`, `format:check`

**Frontend:**
- Same base packages plus `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- `eslint.config.mjs` — flat config with React hooks and refresh rules
- `.prettierrc` — same as backend
- Scripts in package.json: `lint`, `lint:fix`, `format`, `format:check`

**CI:** Add `npm run lint` step before tests in both backend and frontend CI jobs. CI fails on lint errors.

**CONTRIBUTING.md:** Add "Run `npm run lint` and `npm run format:check` before committing" to the workflow section.

**Approach to existing violations:** Run `lint:fix` and `format` once to auto-fix the codebase. Commit the auto-fix separately from the config setup so the diff is reviewable. Remaining manual fixes (if any) addressed individually.

**Acceptance criteria:**
- Backend and frontend both have `lint`, `lint:fix`, `format`, `format:check` scripts
- ESLint and Prettier configs exist for both
- CI fails on lint errors
- CONTRIBUTING.md documents how to run checks locally
- Existing codebase passes lint

---

## #3 — Coverage Thresholds

**Problem:** Backend has `test:cov` but no threshold — coverage can silently regress. Frontend has no coverage config at all.

**Design:**

**Step 1: Measure current baselines.**
- Backend: Run `npm run test:cov`, record lines/branches/functions/statements percentages.
- Frontend: Add `@vitest/coverage-v8` to devDependencies, configure coverage in `vite.config.ts`, run coverage, record baselines.

**Step 2: Set thresholds at baseline minus 2%.**
This is a safety net (prevents regression), not an aspirational target. Rounded down to nearest integer.

**Backend (jest.config.js):**
```javascript
coverageThreshold: {
  global: {
    lines: <baseline - 2>,
    branches: <baseline - 2>,
    functions: <baseline - 2>,
    statements: <baseline - 2>,
  },
},
```

**Frontend (vite.config.ts):**
```typescript
coverage: {
  provider: 'v8',
  thresholds: {
    lines: <baseline - 2>,
    branches: <baseline - 2>,
    functions: <baseline - 2>,
    statements: <baseline - 2>,
  },
},
```

**Scripts:** Add `test:cov` to frontend package.json. Backend already has it.
**CI:** Add coverage check step to CI for both (run `test:cov`, which fails if below threshold).

**Acceptance criteria:**
- Backend jest config has `coverageThreshold` set to measured baseline
- Frontend vitest config has coverage thresholds
- CI fails if coverage drops below threshold
- Baseline values documented in CONTRIBUTING.md

---

## #4 — TypeScript Strictness Rollout

**Problem:**
- Backend: `strictNullChecks: true` only. `noImplicitAny: false`, `forceConsistentCasingInFileNames: false`, `strictBindCallApply: false` — real safety gaps.
- Frontend: `strict: false` entirely — zero null safety on the code users touch. A null reference in a React component = blank screen or crash with no compile-time warning.

**Design — Backend (3 flags, in order):**

1. **`forceConsistentCasingInFileNames: true`** — Highest value, lowest friction. Prevents import casing bugs that break on Linux CI but work on Windows dev. Expected: zero compiler errors if imports already match actual filenames.

2. **`strictBindCallApply: true`** — Catches incorrect `.bind()/.call()/.apply()` usage. Low friction in NestJS (decorators and DI, rarely manual binding). Expected: very few errors.

3. **`noImplicitAny`** — Assess scope. Enable it, count errors. If <50 errors, fix them all. If >=50, document the scope and plan for v0.9.

**Design — Frontend (1 flag):**

4. **`strictNullChecks: true`** — Highest UX impact. Catches null reference errors in React components that would crash the UI at runtime. Enable it, fix all resulting compiler errors. Expected: 20-80 errors based on codebase size (nullable state, optional props, API responses).

Defer full `strict: true` to the decomposition sprint (#5) where large files get refactored anyway.

**UI/QA Gate:** Since #4 modifies frontend component files to fix compiler errors, browser QA is mandatory before commit. The implementation plan must include numbered QA tasks: browser check of rendered states, viewport check, console check.

**Acceptance criteria:**
- Backend: `forceConsistentCasingInFileNames: true`, `strictBindCallApply: true` enabled. `noImplicitAny` either enabled or scope documented.
- Frontend: `strictNullChecks: true` enabled with all compiler errors fixed.
- No new compiler errors in CI after changes.
- Browser QA confirms no visual regressions from frontend changes.

---

## Cross-cutting

- #1 and #2 are independent of each other and can be worked in parallel.
- #3 depends on #1 being done (new integration tests affect coverage baseline).
- #4 is independent but should run after #2 (lint cleanup first, then strictness — avoids fixing the same files twice).
- Recommended order: #2 (lint/format) → #1 (integration tests) → #3 (coverage thresholds) → #4 (TypeScript strictness).
- CONTRIBUTING.md updated as each item lands (not batched to the end).
- Test count will change — docs/index.html test count update needed before push.
