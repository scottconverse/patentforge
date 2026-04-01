# Contributing to PatentForge

Thank you for your interest in contributing to PatentForge! This guide will help you get set up and submitting changes.

## Development Setup

### Prerequisites

- **Node.js** 18+ (recommended: 20 LTS)
- **Python** 3.11+ (for the claim-drafter service)
- **npm** 9+
- **Git**
- **Anthropic API key** (for running the feasibility and claim drafting pipelines)

Optional:
- **Docker** and **Docker Compose** (for containerized deployment)
- **PostgreSQL 16** (if not using SQLite for development)

### Getting Started

1. **Clone the repo**
   ```bash
   git clone https://github.com/scottconverse/patentforge.git
   cd patentforge
   ```

2. **Install dependencies** (all four services)
   ```bash
   cd backend && npm ci && cd ..
   cd services/feasibility && npm ci && cd ../..
   cd services/claim-drafter && pip install -e ".[dev]" && cd ../..
   cd frontend && npm install && cd ..
   ```

   > **Note:** The frontend uses `npm install` (not `npm ci`) because esbuild includes platform-specific optional binaries. A lockfile generated on one OS won't contain binaries for other platforms, causing `npm ci` to fail with `EBADPLATFORM`. The backend and feasibility services don't have this issue and can use `npm ci`.

3. **Set up the database**
   ```bash
   cd backend
   cp ../.env.example .env
   # Edit .env if needed (defaults to SQLite for local dev)
   npx prisma migrate deploy
   npx prisma generate
   cd ..
   ```

4. **Start all services**

   On Windows, run the launcher from the project root:
   ```
   PatentForge.bat
   ```

   Or start each service manually in separate terminals:
   ```bash
   # Terminal 1 — Backend (port 3000)
   cd backend && npm run build && npm run start

   # Terminal 2 — Feasibility service (port 3001)
   cd services/feasibility && npm run build && npm run start

   # Terminal 3 — Frontend (port 8080)
   cd frontend && npm run dev
   ```

5. **Open the app** at http://localhost:8080

6. **Configure your API key** in Settings (gear icon) before running any analysis.

### Docker Setup (alternative)

```bash
docker compose up --build
```

This starts the backend, feasibility service, frontend, and PostgreSQL. Open http://localhost:8080.

## Project Structure

```
patentforge/
├── backend/              # NestJS + Prisma central backend (port 3000)
│   ├── prisma/           # Database schema and migrations
│   └── src/              # Controllers, services, modules
├── services/
│   ├── feasibility/      # Express feasibility pipeline service (port 3001)
│   │   └── src/prompts/  # Stage prompt templates (markdown)
│   └── claim-drafter/    # Python + LangGraph claim drafting service (port 3002)
│       ├── src/agents/   # Planner, Writer, Examiner agents
│       ├── src/prompts/  # Agent prompt templates (CC BY-SA 4.0)
│       └── tests/        # pytest test suite
├── frontend/             # React + Vite + Tailwind frontend (port 8080)
│   └── src/
│       ├── pages/        # Route-level page components
│       └── components/   # Shared UI components
└── docs/                 # GitHub Pages landing page
```

## Running Tests

**GitHub Actions CI** runs backend, frontend, and claim-drafter tests automatically on every push and PR.

```bash
# Backend unit tests (Jest)
cd backend && npm test

# Frontend unit tests (Vitest)
cd frontend && npm test

# Claim drafter tests (pytest)
cd services/claim-drafter && python -m pytest tests/

# Browser E2E tests (Playwright — requires services running)
cd frontend && npx playwright test

# Cleanroom E2E (full nuke-and-rebuild + API smoke tests)
bash scripts/cleanroom-e2e.sh
```

### Playwright E2E Setup

The E2E tests launch all four services (backend, feasibility, claim-drafter, frontend) automatically via Playwright's `webServer` config. Tests run with `workers: 1` because they share a SQLite database that can't handle concurrent writes.

First run requires Chromium and Python dependencies:

```bash
cd services/claim-drafter && pip install . && cd ../..
cd frontend && npx playwright install chromium
```

E2E tests capture screenshots to `frontend/e2e-screenshots/` (gitignored), check browser console for errors, and test at both desktop and mobile viewports.

## Making Changes

1. **Create a branch** from `master`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes.** Follow existing code patterns and conventions.

3. **Test your changes** — run the app locally and verify the feature works end-to-end.

4. **Commit** with a meaningful message:
   ```bash
   git commit -m "feat: add description of your change"
   ```

5. **Push and open a PR** against `master`.

## Commit Message Format

We use conventional commit prefixes:

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `chore:` — build process, dependency updates, etc.

## Code Style

- **TypeScript** for backend, feasibility service, and frontend
- **Python** for the claim-drafter service (FastAPI, LangGraph, pytest)
- **Tailwind CSS** for styling (no custom CSS files unless necessary)
- **NestJS conventions** for backend (controllers, services, modules, DTOs)
- **React functional components** with hooks
- **No TODO/FIXME comments** — either fix the issue or open a GitHub issue

## Architecture Notes

PatentForge uses a federated service architecture. Each capability (feasibility analysis, prior art search, claim drafting, etc.) is an independent service that communicates with the central backend over HTTP/SSE. See [ARCHITECTURE.md](ARCHITECTURE.md) for full details.

When adding a new service:
1. Create a new directory under `services/`
2. Create an adapter in `backend/src/` to connect it
3. Add it to `docker-compose.yml`
4. Update the architecture documentation

## Reporting Issues

Use [GitHub Issues](https://github.com/scottconverse/patentforge/issues) for bug reports and feature requests. Include:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser/OS/Node version if relevant

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
