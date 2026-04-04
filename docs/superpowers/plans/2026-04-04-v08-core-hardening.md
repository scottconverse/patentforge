# v0.8 Core Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lint/format enforcement, backend integration tests, coverage thresholds, and TypeScript strictness to both backend and frontend.

**Architecture:** Four independent hardening concerns applied to the existing NestJS backend and React/Vite frontend. Lint/format first (establishes code style before other changes), then integration tests (adds test coverage), then coverage thresholds (locks in the new baseline), then TypeScript strictness (catches type-level bugs). Task #4 modifies frontend component files — browser QA required per CLAUDE.md rule 4.

**Tech Stack:** ESLint v9 (flat config), Prettier, supertest, Jest, Vitest, @vitest/coverage-v8, TypeScript strict flags

**Execution order:** Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 (sequential — each builds on the previous)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `backend/eslint.config.mjs` | Backend ESLint flat config |
| Create | `backend/.prettierrc` | Backend Prettier config |
| Create | `frontend/eslint.config.mjs` | Frontend ESLint flat config |
| Create | `frontend/.prettierrc` | Frontend Prettier config |
| Create | `backend/test/projects.integration.spec.ts` | Integration tests: projects CRUD |
| Create | `backend/test/settings.integration.spec.ts` | Integration tests: settings |
| Create | `backend/test/auth.integration.spec.ts` | Integration tests: auth guard |
| Create | `backend/test/jest-integration.config.js` | Separate jest config for integration tests |
| Modify | `backend/package.json` | Add lint/format/integration scripts, devDependencies |
| Modify | `frontend/package.json` | Add lint/format/coverage scripts, devDependencies |
| Modify | `backend/jest.config.js` | Add coverageThreshold |
| Modify | `frontend/vite.config.ts` | Add coverage config with thresholds |
| Modify | `backend/tsconfig.json` | Enable strict flags |
| Modify | `frontend/tsconfig.json` | Enable strictNullChecks |
| Modify | `frontend/src/**/*.tsx` | Fix strictNullChecks compiler errors |
| Modify | `.github/workflows/ci.yml` | Add lint + coverage + integration test steps |
| Modify | `CONTRIBUTING.md` | Document lint, coverage, and strictness |

---

### Task 1: Backend ESLint + Prettier Setup

**Files:**
- Create: `backend/eslint.config.mjs`
- Create: `backend/.prettierrc`
- Modify: `backend/package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd backend && npm install -D eslint @eslint/js @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-prettier prettier
```

- [ ] **Step 2: Create ESLint flat config**

Create `backend/eslint.config.mjs`:

```javascript
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        sourceType: 'module',
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-unused-vars': 'off', // handled by @typescript-eslint
      'no-undef': 'off', // TypeScript handles this
    },
  },
  prettierConfig,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'prisma/**'],
  },
];
```

- [ ] **Step 3: Create Prettier config**

Create `backend/.prettierrc`:

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 120,
  "tabWidth": 2,
  "semi": true
}
```

- [ ] **Step 4: Add scripts to package.json**

Add to `backend/package.json` scripts:

```json
"lint": "eslint 'src/**/*.ts' 'test/**/*.ts'",
"lint:fix": "eslint 'src/**/*.ts' 'test/**/*.ts' --fix",
"format": "prettier --write 'src/**/*.ts' 'test/**/*.ts'",
"format:check": "prettier --check 'src/**/*.ts' 'test/**/*.ts'"
```

- [ ] **Step 5: Run lint to see current violations**

Run: `cd backend && npm run lint 2>&1 | tail -5`

Note the count. Most should be auto-fixable.

- [ ] **Step 6: Commit config files (before auto-fix)**

```bash
git add backend/eslint.config.mjs backend/.prettierrc backend/package.json backend/package-lock.json
git commit -m "chore: add ESLint + Prettier config to backend (#2)"
```

---

### Task 2: Backend Lint Auto-Fix

**Files:**
- Modify: `backend/src/**/*.ts` (auto-fix only)

- [ ] **Step 1: Run auto-fix**

```bash
cd backend && npm run lint:fix && npm run format
```

- [ ] **Step 2: Run tests to verify no regressions**

```bash
cd backend && npm test
```

Expected: 234 tests pass (same as before)

- [ ] **Step 3: Commit auto-fix separately**

```bash
cd backend && git add -A && git commit -m "style: auto-fix backend lint + format (#2)"
```

- [ ] **Step 4: Run lint to verify clean**

```bash
cd backend && npm run lint
```

Expected: 0 errors. If warnings remain, note them but don't block.

- [ ] **Step 5: Fix any remaining manual lint errors**

If `npm run lint` shows errors that couldn't be auto-fixed, fix them manually. Re-run tests after each fix.

- [ ] **Step 6: Commit manual fixes if any**

```bash
git add -A && git commit -m "style: fix remaining backend lint errors (#2)"
```

---

### Task 3: Frontend ESLint + Prettier Setup + Auto-Fix

**Files:**
- Create: `frontend/eslint.config.mjs`
- Create: `frontend/.prettierrc`
- Modify: `frontend/package.json`
- Modify: `frontend/src/**/*.{ts,tsx}` (auto-fix)

- [ ] **Step 1: Install dependencies**

```bash
cd frontend && npm install -D eslint @eslint/js @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-prettier prettier eslint-plugin-react-hooks eslint-plugin-react-refresh
```

- [ ] **Step 2: Create ESLint flat config**

Create `frontend/eslint.config.mjs`:

```javascript
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLSelectElement: 'readonly',
        EventSource: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        Event: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        RequestInit: 'readonly',
        CustomEvent: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
  prettierConfig,
  {
    ignores: ['dist/**', 'node_modules/**', 'e2e/**', 'e2e-results/**', 'e2e-screenshots/**'],
  },
];
```

- [ ] **Step 3: Create Prettier config**

Create `frontend/.prettierrc`:

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 120,
  "tabWidth": 2,
  "semi": true
}
```

- [ ] **Step 4: Add scripts to package.json**

Add to `frontend/package.json` scripts:

```json
"lint": "eslint 'src/**/*.{ts,tsx}'",
"lint:fix": "eslint 'src/**/*.{ts,tsx}' --fix",
"format": "prettier --write 'src/**/*.{ts,tsx}'",
"format:check": "prettier --check 'src/**/*.{ts,tsx}'"
```

- [ ] **Step 5: Commit config (before auto-fix)**

```bash
git add frontend/eslint.config.mjs frontend/.prettierrc frontend/package.json frontend/package-lock.json
git commit -m "chore: add ESLint + Prettier config to frontend (#2)"
```

- [ ] **Step 6: Run auto-fix**

```bash
cd frontend && npm run lint:fix && npm run format
```

- [ ] **Step 7: Run tests to verify no regressions**

```bash
cd frontend && npm test
```

Expected: 83 tests pass

- [ ] **Step 8: Commit auto-fix**

```bash
cd frontend && git add -A && git commit -m "style: auto-fix frontend lint + format (#2)"
```

- [ ] **Step 9: Fix any remaining lint errors, commit**

Same pattern as backend Task 2. Run `npm run lint`, fix manually, re-test, commit.

---

### Task 4: Add Lint to CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add lint step to backend-tests job**

In `.github/workflows/ci.yml`, in the `backend-tests` job, add a lint step after "Generate Prisma client" and before "Run tests":

```yaml
      - name: Lint
        run: cd backend && npm run lint
```

- [ ] **Step 2: Add lint step to frontend-tests job**

In the `frontend-tests` job, add after "Install dependencies" and before "Run tests":

```yaml
      - name: Lint
        run: cd frontend && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint step to backend and frontend CI jobs (#2)"
```

---

### Task 5: Update CONTRIBUTING.md for Lint/Format

**Files:**
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Update the "Code Style" section**

In `CONTRIBUTING.md`, find the "## Code Style" section and add after the existing bullet points:

```markdown
### Linting and Formatting

Both backend and frontend enforce code style with ESLint and Prettier. Run these before committing:

```bash
# Backend
cd backend && npm run lint && npm run format:check

# Frontend
cd frontend && npm run lint && npm run format:check
```

To auto-fix issues:

```bash
cd backend && npm run lint:fix && npm run format
cd frontend && npm run lint:fix && npm run format
```

CI will fail if lint errors are present.
```

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add lint/format instructions to CONTRIBUTING.md (#2)"
```

---

### Task 6: Backend Integration Tests (supertest)

**Files:**
- Create: `backend/test/jest-integration.config.js`
- Create: `backend/test/projects.integration.spec.ts`
- Create: `backend/test/settings.integration.spec.ts`
- Create: `backend/test/auth.integration.spec.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Install supertest**

```bash
cd backend && npm install -D supertest @types/supertest
```

- [ ] **Step 2: Create integration test jest config**

Create `backend/test/jest-integration.config.js`:

```javascript
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: 'test/.*\\.integration\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(marked|docx)/)',
  ],
  testEnvironment: 'node',
};
```

- [ ] **Step 3: Add test:integration script**

Add to `backend/package.json` scripts:

```json
"test:integration": "jest --config test/jest-integration.config.js --runInBand"
```

- [ ] **Step 4: Create projects integration test**

Create `backend/test/projects.integration.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Projects API (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Use in-memory SQLite for integration tests
    process.env.DATABASE_URL = 'file::memory:?cache=shared';
    // Disable auth for these tests
    delete process.env.PATENTFORGE_TOKEN;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    // Push schema to in-memory db
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Project" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'INTAKE',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('DELETE FROM "Project"');
  });

  it('POST /api/projects — creates a project', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/projects')
      .send({ title: 'Test Patent' })
      .expect(201);

    expect(res.body.title).toBe('Test Patent');
    expect(res.body.status).toBe('INTAKE');
    expect(res.body.id).toBeDefined();
  });

  it('POST /api/projects — 400 without title', async () => {
    await request(app.getHttpServer())
      .post('/api/projects')
      .send({})
      .expect(400);
  });

  it('GET /api/projects — returns list', async () => {
    // Create a project first
    await request(app.getHttpServer())
      .post('/api/projects')
      .send({ title: 'List Test' });

    const res = await request(app.getHttpServer())
      .get('/api/projects')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/projects/:id — 404 for nonexistent', async () => {
    await request(app.getHttpServer())
      .get('/api/projects/nonexistent-uuid')
      .expect(404);
  });

  it('DELETE /api/projects/:id — deletes project', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/projects')
      .send({ title: 'To Delete' });

    await request(app.getHttpServer())
      .delete(`/api/projects/${create.body.id}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/projects/${create.body.id}`)
      .expect(404);
  });
});
```

**Note:** The in-memory SQLite setup with raw CREATE TABLE is a starting point. The implementer should check whether `prisma db push` or `prisma migrate` can be used programmatically instead. If Prisma supports `$executeRawUnsafe` with the full schema push, use that. If not, the raw CREATE TABLE approach works but only covers the Project table — the implementer should add tables for InventionInput and other models tested, OR find the Prisma programmatic schema push approach.

- [ ] **Step 5: Create settings integration test**

Create `backend/test/settings.integration.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Settings API (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'file::memory:?cache=shared';
    delete process.env.PATENTFORGE_TOKEN;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/settings — returns defaults', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/settings')
      .expect(200);

    expect(res.body.defaultModel).toBeDefined();
    expect(res.body.maxTokens).toBeDefined();
  });

  it('PUT /api/settings — updates settings', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/settings')
      .send({ maxTokens: 64000 })
      .expect(200);

    expect(res.body.maxTokens).toBe(64000);
  });
});
```

- [ ] **Step 6: Create auth guard integration test**

Create `backend/test/auth.integration.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthGuard } from '../src/auth.guard';

describe('Auth Guard (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'file::memory:?cache=shared';
    process.env.PATENTFORGE_TOKEN = 'test-secret-token';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalGuards(new AuthGuard());
    await app.init();
  });

  afterAll(async () => {
    delete process.env.PATENTFORGE_TOKEN;
    await app.close();
  });

  it('401 without Authorization header', async () => {
    await request(app.getHttpServer())
      .get('/api/projects')
      .expect(401);
  });

  it('401 with wrong token', async () => {
    await request(app.getHttpServer())
      .get('/api/projects')
      .set('Authorization', 'Bearer wrong-token')
      .expect(401);
  });

  it('200 with correct token', async () => {
    await request(app.getHttpServer())
      .get('/api/projects')
      .set('Authorization', 'Bearer test-secret-token')
      .expect(200);
  });
});
```

- [ ] **Step 7: Run integration tests**

```bash
cd backend && npm run test:integration
```

Expected: All integration tests pass. If Prisma in-memory SQLite fails, the implementer should investigate the right approach (e.g., file-based temp SQLite with `prisma db push`) and adjust.

- [ ] **Step 8: Commit**

```bash
git add backend/test/ backend/package.json backend/package-lock.json
git commit -m "test: add backend API integration tests with supertest (#1)"
```

---

### Task 7: Add Integration Tests to CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add integration test step to backend-tests job**

In `.github/workflows/ci.yml`, in the `backend-tests` job, add after "Run tests":

```yaml
      - name: Run integration tests
        run: cd backend && npm run test:integration
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add backend integration test step (#1)"
```

---

### Task 8: Coverage Thresholds

**Files:**
- Modify: `backend/jest.config.js`
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Measure backend coverage baseline**

```bash
cd backend && npm run test:cov 2>&1 | grep -A 5 "All files"
```

Record the lines/branches/functions/statements percentages.

- [ ] **Step 2: Set backend coverage threshold**

In `backend/jest.config.js`, add `coverageThreshold` with values = measured baseline minus 2, rounded down:

```javascript
coverageThreshold: {
  global: {
    lines: <measured - 2>,
    branches: <measured - 2>,
    functions: <measured - 2>,
    statements: <measured - 2>,
  },
},
```

- [ ] **Step 3: Verify backend coverage still passes**

```bash
cd backend && npm run test:cov
```

Expected: PASS (threshold is below actual)

- [ ] **Step 4: Install frontend coverage provider**

```bash
cd frontend && npm install -D @vitest/coverage-v8
```

- [ ] **Step 5: Add coverage config to vite.config.ts**

Update the `test` block in `frontend/vite.config.ts` to add coverage:

```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/test-setup.ts'],
  css: true,
  exclude: ['e2e/**', 'node_modules/**'],
  coverage: {
    provider: 'v8',
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['src/test-setup.ts', 'src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
  },
},
```

- [ ] **Step 6: Add test:cov script to frontend**

Add to `frontend/package.json` scripts:

```json
"test:cov": "vitest run --coverage"
```

- [ ] **Step 7: Measure frontend coverage baseline**

```bash
cd frontend && npm run test:cov 2>&1 | grep -A 5 "All files"
```

Record the lines/branches/functions/statements percentages.

- [ ] **Step 8: Add thresholds to vite.config.ts**

Update the coverage block with thresholds (baseline minus 2):

```typescript
coverage: {
  provider: 'v8',
  include: ['src/**/*.{ts,tsx}'],
  exclude: ['src/test-setup.ts', 'src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
  thresholds: {
    lines: <measured - 2>,
    branches: <measured - 2>,
    functions: <measured - 2>,
    statements: <measured - 2>,
  },
},
```

- [ ] **Step 9: Verify frontend coverage passes**

```bash
cd frontend && npm run test:cov
```

Expected: PASS

- [ ] **Step 10: Add coverage to CI**

In `.github/workflows/ci.yml`:

Backend-tests job — change `npm test` to `npm run test:cov`:
```yaml
      - name: Run tests with coverage
        run: cd backend && npm run test:cov
```

Frontend-tests job — change `npm test` to `npm run test:cov`:
```yaml
      - name: Run tests with coverage
        run: cd frontend && npm run test:cov
```

- [ ] **Step 11: Commit**

```bash
git add backend/jest.config.js frontend/vite.config.ts frontend/package.json frontend/package-lock.json .github/workflows/ci.yml
git commit -m "test: add coverage thresholds to backend and frontend (#3)"
```

---

### Task 9: Update CONTRIBUTING.md for Coverage

**Files:**
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Add coverage section**

Add after the "Linting and Formatting" section added in Task 5:

```markdown
### Test Coverage

Coverage thresholds prevent silent regression. CI fails if coverage drops below the baseline.

```bash
# Run with coverage
cd backend && npm run test:cov
cd frontend && npm run test:cov
```

Current baselines (set <date>):
- Backend: lines <X>%, branches <X>%, functions <X>%, statements <X>%
- Frontend: lines <X>%, branches <X>%, functions <X>%, statements <X>%

When adding new code, add tests. When the baseline increases, update the thresholds in `backend/jest.config.js` and `frontend/vite.config.ts`.
```

Fill in the actual measured values from Task 8.

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add coverage threshold documentation (#3)"
```

---

### Task 10: Backend TypeScript Strictness

**Files:**
- Modify: `backend/tsconfig.json`
- Possibly modify: `backend/src/**/*.ts` (if compiler errors)

- [ ] **Step 1: Enable forceConsistentCasingInFileNames**

In `backend/tsconfig.json`, change:
```json
"forceConsistentCasingInFileNames": true
```

- [ ] **Step 2: Build to check for errors**

```bash
cd backend && npm run build 2>&1 | head -30
```

Expected: 0 errors (if imports already match filenames).

- [ ] **Step 3: Enable strictBindCallApply**

```json
"strictBindCallApply": true
```

- [ ] **Step 4: Build to check**

```bash
cd backend && npm run build 2>&1 | head -30
```

Expected: 0-2 errors. Fix any that appear.

- [ ] **Step 5: Assess noImplicitAny**

```json
"noImplicitAny": true
```

```bash
cd backend && npm run build 2>&1 | grep "error TS" | wc -l
```

If <50 errors: fix them all. If >=50: revert `noImplicitAny` to `false`, document the count and plan for v0.9.

- [ ] **Step 6: Run tests**

```bash
cd backend && npm test && npm run test:integration
```

Expected: All tests pass

- [ ] **Step 7: Run lint**

```bash
cd backend && npm run lint
```

Expected: Clean (or same warnings as before)

- [ ] **Step 8: Commit**

```bash
git add backend/tsconfig.json backend/src/
git commit -m "chore: enable backend TypeScript strict flags (#4)"
```

---

### Task 11: Frontend strictNullChecks

**Files:**
- Modify: `frontend/tsconfig.json`
- Modify: `frontend/src/**/*.{ts,tsx}` (fix compiler errors)

- [ ] **Step 1: Enable strictNullChecks**

In `frontend/tsconfig.json`, change `"strict": false` to:
```json
"strict": false,
"strictNullChecks": true
```

- [ ] **Step 2: Count compiler errors**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Record the count. Expected: 20-80 errors.

- [ ] **Step 3: List all errors by file**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "error TS" | sed 's/(.*//;s/src/\nsrc/' | sort | uniq -c | sort -rn | head -20
```

This shows which files have the most errors — fix those first.

- [ ] **Step 4: Fix all compiler errors**

Common patterns to fix:
- `useState<Type | null>(null)` — add `| null` to state that can be null
- Optional chaining: `obj?.prop` instead of `obj.prop` when obj might be null
- Non-null assertions: `value!` when you've already checked (sparingly)
- Type narrowing: `if (value) { ... }` before using nullable values
- API response types: add `| null` or `| undefined` where API returns optional fields

Fix files one at a time. After each file, run `npx tsc --noEmit` to verify error count decreases.

- [ ] **Step 5: Verify zero compiler errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Run tests**

```bash
cd frontend && npm test
```

Expected: 83+ tests pass

- [ ] **Step 7: Run lint**

```bash
cd frontend && npm run lint
```

Expected: Clean

- [ ] **Step 8: Commit**

```bash
cd frontend && git add -A && git commit -m "chore: enable frontend strictNullChecks — fix all compiler errors (#4)"
```

---

### Task 12: Browser QA — Frontend strictNullChecks Changes

**UI/QA Gate (CLAUDE.md Rule 4): Since Task 11 modifies frontend component files, browser verification is mandatory.**

- [ ] **Step 1: Start frontend dev server**

Start the frontend with `preview_start` or `npm run dev`.

- [ ] **Step 2: Navigate to project list (/)**

Verify: page renders, "Projects" heading visible, "+ New Project" button present. No blank screens.

- [ ] **Step 3: Navigate to a project detail page**

Verify: project loads (or shows error state with Retry button if backend is down). No crashes.

- [ ] **Step 4: Navigate to Settings (/settings)**

Verify: settings page renders, form fields visible, API key field present.

- [ ] **Step 5: Check desktop and mobile viewports**

Verify: no layout breakage at both desktop (1280px) and mobile (375px).

- [ ] **Step 6: Check browser console**

Verify: no new errors or warnings. Note any pre-existing warnings.

- [ ] **Step 7: Stop dev server**

- [ ] **Step 8: Record QA evidence**

No code changes — this is verification only. Results recorded as part of the task report.

---

### Task 13: Final Verification

- [ ] **Step 1: Run all test suites**

```bash
cd backend && npm test && npm run test:integration
cd frontend && npm test
```

Expected: All suites pass

- [ ] **Step 2: Run lint on both**

```bash
cd backend && npm run lint
cd frontend && npm run lint
```

Expected: Clean

- [ ] **Step 3: Run coverage on both**

```bash
cd backend && npm run test:cov
cd frontend && npm run test:cov
```

Expected: Coverage thresholds met

- [ ] **Step 4: Build check**

```bash
cd backend && npm run build
cd frontend && npm run build
```

Expected: Clean builds, 0 compiler errors

- [ ] **Step 5: Git status clean**

```bash
git status
```

Expected: Clean working tree

- [ ] **Step 6: Note for pre-push**

Do NOT push yet. Version bump, doc updates (test counts in docs/index.html), and pre-push gates happen when v0.8 is complete.
