# PatentForge v0.7 — Installer Design Spec

**Date:** 2026-04-02
**Status:** Draft — pending review
**Goal:** Package the existing 6-service PatentForge architecture into downloadable installers for Windows, Mac, and Linux. No backend rewrite. Non-technical users should be able to download one file, install it, and use PatentForge without ever opening a terminal.

---

## 1. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Target user | Non-technical | "Double-click .exe, click Next, launch from Start Menu" — zero CLI |
| Background model | System tray app | App-like behavior: tray icon, context menu, survives browser close |
| Tray technology | Go + systray | Single binary, no runtime, cross-platform, proven (Lantern, Syncthing) |
| Install wizard | Standard (Welcome → License → Directory → Install → Finish) | Familiar to every Windows user; lets power users change directory |
| API key setup | First-run wizard in browser | Keeps secrets out of installer; testable; better UX than "find Settings" |
| Node services | Node SEA (Single Executable Application) | Backend + feasibility compiled to standalone .exe; no Node runtime shipped |
| Python services | Portable Python 3.12 runtime | PyInstaller has AV false positive and cold-start risks; defer to v1.0 |
| Tray app | Go binary | Already a single binary; no runtime needed |
| Bundling | Everything in installer | ~80-100MB; no internet required during install |
| Platforms | Windows (full), Mac (beta), Linux (beta) | CI builds all three; Mac/Linux marked beta on landing page |
| Update mechanism | Manual download (v0.7) | "Check for Updates" link in Settings opens GitHub releases page |
| Mac code signing | Skip | Beta label; revisit if demand warrants $99/year Apple Developer cert |
| v1.0 gate | Single-binary Python services | PyInstaller or Nuitka for all 3 Python services; non-negotiable release gate |

---

## 2. Architecture

### System overview

```
User clicks shortcut
        │
        ▼
┌─────────────────────────────────────────────────┐
│  patentforge-tray (.exe / binary)               │
│  Go system tray app                             │
│  - Single-instance check (mutex/lockfile)       │
│  - First-run config generation                  │
│  - Prisma database setup                        │
│  - Service lifecycle management                 │
│  - Health monitoring (HTTP pings every 30s)     │
│  - Auto-restart failed services (3 attempts)    │
│  - Tray menu: Open / View Logs / Restart / Quit │
│  - Opens default browser on startup             │
└──────────┬──────────────────────────────────────┘
           │ spawns (5 processes)
           │
    ┌──────┴──────────────────────────────────────┐
    │                                              │
    │  patentforge-backend.exe    (Node SEA, 3000) │
    │  patentforge-feasibility.exe(Node SEA, 3001) │
    │  python.exe claim-drafter        (port 3002) │
    │  python.exe application-generator(port 3003) │
    │  python.exe compliance-checker   (port 3004) │
    │                                              │
    │  Frontend: static files served by backend    │
    │  (no separate process — ServeStaticModule)   │
    │                                              │
    └──────────────────────────────────────────────┘
```

### Key architectural choices

**Frontend serving:** The NestJS backend serves the pre-built frontend static files via `@nestjs/serve-static`. No separate frontend process. This reduces the process count from 6 to 5 and eliminates the need for a Vite dev server or nginx in the installed version.

**Database:** SQLite via Prisma, stored in `data/patentforge.db`. The database file lives outside the services directory so upgrades don't touch user data.

**Config generation:** On first run, the tray app generates `config/.env` with:
- `DATABASE_URL=file:../data/patentforge.db` (relative to backend working dir)
- `INTERNAL_SERVICE_SECRET=<random 64 hex chars>`
- `ALLOWED_ORIGINS=http://localhost:8080`
- `NODE_ENV=production`

---

## 3. Install Directory Layout

```
PatentForge/                           # Install root
├── patentforge-tray.exe               # Go tray app — the entry point users click
├── patentforge-backend.exe            # NestJS backend (Node SEA, ~50MB)
├── patentforge-backend-prisma/        # Prisma runtime files
│   ├── query_engine-<platform>.node   # Platform-specific query engine
│   └── schema.prisma                  # Database schema
├── patentforge-feasibility.exe        # Feasibility service (Node SEA, ~40MB)
├── patentforge-feasibility-prompts/   # Stage 1-6 prompt markdown files
│   ├── common-rules.md
│   ├── stage-1.md ... stage-6.md
├── runtime/
│   └── python/                        # Portable Python 3.12 (~15MB)
│       ├── python.exe                 # (python3 on Mac/Linux)
│       ├── Lib/site-packages/         # Pre-installed: FastAPI, LangGraph, Anthropic, uvicorn, etc.
│       └── Scripts/                   # (bin/ on Mac/Linux) — uvicorn entry point
├── services/
│   ├── claim-drafter/src/             # Python source
│   ├── application-generator/src/     # Python source
│   ├── compliance-checker/src/        # Python source
│   └── frontend/dist/                 # Pre-built Vite output (static HTML/JS/CSS)
├── data/                              # USER DATA — survives upgrades
│   └── patentforge.db                 # SQLite database (created on first run)
├── logs/                              # Service logs (rotated)
│   ├── backend.log
│   ├── feasibility.log
│   ├── claim-drafter.log
│   ├── application-generator.log
│   └── compliance-checker.log
└── config/                            # Configuration — survives upgrades
    └── .env                           # Generated on first run
```

### Upgrade safety

The installer distinguishes between three categories:

| Category | Contents | On upgrade |
|----------|----------|-----------|
| **Executables** | tray, backend, feasibility .exe files | Replaced |
| **Services & runtimes** | Python runtime, Python service source, frontend dist, Prisma files, prompts | Replaced |
| **User data** | `data/`, `config/`, `logs/` | Never touched |

Inno Setup's `[Files]` section flags user data directories with `onlyifdoesntexist` or excludes them entirely. The user's projects, API keys, and database survive every upgrade.

---

## 4. Tray App Specification

### Technology

- **Language:** Go
- **Tray library:** `fyne-io/systray` (actively maintained fork of getlantern/systray)
- **Binary size:** ~8-12MB per platform
- **Platforms:** Windows, Mac, Linux (same codebase, three compile targets)

### Startup sequence

1. **Single-instance check.** Acquire a named mutex (Windows) or lockfile (Mac/Linux). If another instance is running, signal it to come to foreground and exit.
2. **Show tray icon** with tooltip "PatentForge — Starting..."
3. **Check first run.** If `config/.env` does not exist:
   - Generate `INTERNAL_SERVICE_SECRET` (crypto/rand, 32 bytes hex)
   - Write `config/.env` with defaults
   - Create `data/` directory
4. **Run Prisma database setup.** Execute `patentforge-backend.exe prisma db push` (or equivalent). This creates/migrates the SQLite database on first run.
5. **Start services sequentially,** waiting for each port to accept connections before starting the next:
   - `patentforge-backend.exe` (port 3000) — env vars from `config/.env`
   - `patentforge-feasibility.exe` (port 3001)
   - `runtime/python/python.exe -m uvicorn src.server:app --host 127.0.0.1 --port 3002` (claim-drafter, cwd=`services/claim-drafter`)
   - Same pattern for application-generator (3003) and compliance-checker (3004)
6. **Update tray** tooltip to "PatentForge — Running" and icon to active state.
7. **Open default browser** to `http://localhost:8080`.

### Port conflict handling

Before starting each service, check if the port is already in use. If it is:
- Show a Windows notification: "PatentForge: Port 3000 is already in use by another application. Please close it and click Restart."
- Set tray tooltip to "PatentForge — Port conflict"
- Do not start remaining services
- User clicks Restart from tray menu after resolving

### Health monitoring

- Every 30 seconds, HTTP GET to each service's health/root endpoint
- Track consecutive failures per service
- On first failure: log it, retry on next cycle
- On 3 consecutive failures: attempt service restart (kill + re-spawn)
- On restart failure: show notification "PatentForge: [service] failed. Click View Logs for details."
- Tray tooltip reflects overall status: "Running", "Degraded (claim-drafter down)", "Starting..."

### Tray menu

| Menu item | Action |
|-----------|--------|
| **Open PatentForge** | Open default browser to `http://localhost:8080` |
| **Status: Running** | Disabled label showing current state |
| --- | Separator |
| **View Logs** | Open `logs/` directory in file explorer |
| **Restart Services** | Kill all → re-run startup sequence |
| **About PatentForge v0.7.0** | Shows version; "Check for Updates" opens GitHub releases page |
| --- | Separator |
| **Quit** | Graceful shutdown (see below) |

### Shutdown sequence

1. Send interrupt signal to each child process (SIGTERM on Mac/Linux, GenerateConsoleCtrlEvent or TerminateProcess on Windows)
2. Wait up to 5 seconds for graceful exit
3. Force-kill any remaining processes
4. Remove lockfile
5. Exit tray app

### Logging

Each service's stdout/stderr is captured and written to `logs/<service>.log`. Logs are rotated: keep last 5 files, max 10MB each. The tray app's own log goes to `logs/tray.log`.

---

## 5. Node SEA Build Process

### Backend (NestJS)

```bash
# 1. Build TypeScript
cd backend && npm run build

# 2. Create SEA config
cat > sea-config.json << 'EOF'
{
  "main": "dist/main.js",
  "output": "sea-prep.blob",
  "disableExperimentalSEAWarning": true,
  "assets": {
    "prisma-schema": "prisma/schema.prisma"
  }
}
EOF

# 3. Generate blob
node --experimental-sea-config sea-config.json

# 4. Copy node binary and inject blob
cp $(which node) patentforge-backend.exe
npx postject patentforge-backend.exe NODE_SEA_BLOB sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

# 5. Copy Prisma engine alongside
mkdir patentforge-backend-prisma
cp node_modules/.prisma/client/query_engine-* patentforge-backend-prisma/
cp prisma/schema.prisma patentforge-backend-prisma/
```

**Runtime requirements:**
- `PRISMA_QUERY_ENGINE_LIBRARY` env var pointing to the query engine file
- `prisma/schema.prisma` accessible (via asset or filesystem)
- `node_modules/` is NOT needed — all JavaScript is bundled in the blob

**Bundling strategy:** Node SEA bundles a single JS entry file, but NestJS and its dependencies are spread across many files in `node_modules/`. We use `ncc` (by Vercel) to compile the entire backend into a single JS file first, then feed that to SEA. `ncc` is the proven path for NestJS — it's used by Vercel for serverless deployment of NestJS apps. The flow is: `tsc` → `ncc build dist/main.js` → single `index.js` → SEA blob. If `ncc` fails on specific dependencies, `esbuild` is the fallback bundler.

### Feasibility (Express)

Same process but simpler — no Prisma. The prompt markdown files are bundled as SEA assets or shipped alongside as `patentforge-feasibility-prompts/`.

---

## 6. Frontend Serving

### Change required in backend

Add `@nestjs/serve-static` to the backend to serve the pre-built frontend:

```typescript
// app.module.ts
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'frontend', 'dist'),
      serveRoot: '/',
      exclude: ['/api/*', '/feasibility/*'],
    }),
    // ... existing modules
  ],
})
```

The frontend Vite proxy config (`/api/ → localhost:3000`) is no longer needed — the API and frontend are served from the same origin. This eliminates CORS for the installed version.

### Port 8080 → port 3000

In the installed version, the user accesses `http://localhost:3000` (the backend serves both API and frontend). Port 8080 is no longer used. The tray app opens the browser to `http://localhost:3000`.

The dev workflow is unchanged — `npm run dev` in the frontend still runs Vite on 8080 with the API proxy.

---

## 7. First-Run Experience

### Flow

1. User launches PatentForge (clicks shortcut / tray icon)
2. Tray app starts, generates config, starts services, opens browser
3. **Disclaimer modal** appears (existing — unchanged)
4. User accepts disclaimer
5. **First-run setup wizard** detects no API key configured:

```
┌─────────────────────────────────────────────────┐
│                                                  │
│  Welcome to PatentForge!                         │
│                                                  │
│  To analyze inventions, you need an Anthropic    │
│  API key. Here's how to get one:                 │
│                                                  │
│  1. Go to console.anthropic.com                  │
│  2. Create a free account                        │
│  3. Go to API Keys → Create Key                  │
│  4. Copy the key and paste it below              │
│                                                  │
│  ┌──────────────────────────────────────┐        │
│  │ sk-ant-...                           │        │
│  └──────────────────────────────────────┘        │
│                                                  │
│  [Validate Key]  [Skip for Now]                  │
│                                                  │
│  Your key is encrypted and stored locally.       │
│  It is only sent to Anthropic's API.             │
│                                                  │
└─────────────────────────────────────────────────┘
```

6. **Validate Key** makes a lightweight API call (e.g., `POST /v1/messages` with a tiny prompt) to confirm the key works. Shows success or clear error ("Invalid key", "Key expired", "Network error — check your internet connection").
7. On success or skip, user lands on the Projects page.

### Implementation

The first-run wizard is a React component in the frontend. It checks the backend Settings API for an API key on mount. If none is configured, it renders the wizard instead of the normal page content. This is frontend-only work — no backend changes needed beyond what already exists.

---

## 8. Packaging Per Platform

### Windows (Inno Setup)

**Installer:** `PatentForge-0.7.0-Setup.exe` (~80-100MB)

**Wizard screens:**
1. Welcome — PatentForge logo, version, "This will install PatentForge on your computer"
2. License — MIT license text, "I accept" checkbox
3. Directory — Default `C:\Program Files\PatentForge`, Browse button
4. Install — Progress bar
5. Finish — "Launch PatentForge" checkbox (checked by default), Finish button

**What the installer does:**
- Extracts all files to chosen directory
- Creates Start Menu folder with "PatentForge" shortcut → `patentforge-tray.exe`
- Creates Desktop shortcut (optional checkbox)
- Registers uninstaller in Windows Add/Remove Programs
- Optionally launches tray app on finish

**Uninstall behavior:**
- Removes all files in install directory EXCEPT `data/` and `config/`
- Asks user: "Do you want to remove your PatentForge data (projects, settings, database)? This cannot be undone." Yes removes `data/` and `config/`. No preserves them.
- Removes Start Menu and Desktop shortcuts
- Removes registry entries

### Mac (.app bundle in .dmg)

**Installer:** `PatentForge-0.7.0.dmg` (~80-100MB)

**Structure:**
```
PatentForge.app/
└── Contents/
    ├── Info.plist              # App metadata, version, icon
    ├── MacOS/
    │   └── patentforge-tray    # Go binary (entry point)
    ├── Resources/
    │   ├── patentforge.icns    # App icon
    │   ├── patentforge-backend # Node SEA binary
    │   ├── patentforge-feasibility
    │   ├── prisma/             # Prisma engine + schema
    │   ├── prompts/            # Feasibility prompts
    │   ├── runtime/python/     # Portable Python
    │   ├── services/           # Python services + frontend dist
    │   └── config/             # Template .env
    └── Frameworks/             # (empty — no frameworks needed)
```

**User data location:** `~/Library/Application Support/PatentForge/` (data/, logs/, config/)

**Install experience:** Open .dmg → drag PatentForge to Applications → close .dmg. First launch: right-click → Open → confirm unsigned app warning.

### Linux (AppImage)

**Installer:** `PatentForge-0.7.0.AppImage` (~100-120MB)

**Structure:** AppImage is a self-contained filesystem image. Contains the tray binary, Node SEA executables, portable Python, all service code, and an AppRun entry script.

**User data location:** `~/.local/share/patentforge/` (data/, logs/, config/)

**Install experience:** Download, `chmod +x`, double-click (or run from terminal). No `sudo`, no package manager, works on any distro with a graphical desktop.

**Desktop integration:** On first run, optionally creates a `.desktop` file in `~/.local/share/applications/` for launcher/menu integration.

---

## 9. CI Release Workflow

### Trigger

Pushing a Git tag matching `v*` (e.g., `v0.7.0`) triggers the release workflow.

### Jobs

```
Tag push (v0.7.0)
│
├─ build-windows (runs-on: windows-latest)
│   ├─ Checkout code
│   ├─ Setup Go 1.22+
│   ├─ Build tray app: go build -o patentforge-tray.exe ./cmd/tray
│   ├─ Setup Node 20
│   ├─ Build backend SEA:
│   │   npm ci → npm run build → ncc build → node SEA → patentforge-backend.exe
│   ├─ Build feasibility SEA: same pattern
│   ├─ Download Python 3.12 embeddable for Windows
│   ├─ pip install Python service dependencies into portable Python
│   ├─ Build frontend: npm ci → npm run build → dist/
│   ├─ Copy Prisma engine + schema
│   ├─ Compile Inno Setup script → PatentForge-0.7.0-Setup.exe
│   └─ Upload artifact
│
├─ build-mac (runs-on: macos-latest)
│   ├─ Checkout code
│   ├─ Setup Go 1.22+
│   ├─ Build tray app: go build -o patentforge-tray ./cmd/tray
│   ├─ Setup Node 20
│   ├─ Build backend SEA (Mac binary)
│   ├─ Build feasibility SEA (Mac binary)
│   ├─ Download Python 3.12 standalone for Mac
│   ├─ pip install dependencies
│   ├─ Build frontend
│   ├─ Assemble .app bundle
│   ├─ Create .dmg with create-dmg
│   └─ Upload artifact
│
├─ build-linux (runs-on: ubuntu-latest)
│   ├─ Checkout code
│   ├─ Setup Go 1.22+
│   ├─ Build tray app: go build -o patentforge-tray ./cmd/tray
│   ├─ Setup Node 20
│   ├─ Build backend SEA (Linux binary)
│   ├─ Build feasibility SEA (Linux binary)
│   ├─ Download Python 3.12 standalone for Linux
│   ├─ pip install dependencies
│   ├─ Build frontend
│   ├─ Create AppImage with appimagetool
│   └─ Upload artifact
│
└─ create-release (needs: build-windows, build-mac, build-linux)
    ├─ Create GitHub Release for tag v0.7.0
    ├─ Attach: PatentForge-0.7.0-Setup.exe
    ├─ Attach: PatentForge-0.7.0.dmg
    ├─ Attach: PatentForge-0.7.0.AppImage
    └─ Generate release notes from CHANGELOG.md
```

### Build time estimate

Each platform job: ~5-8 minutes. Total with parallelism: ~10 minutes.

---

## 10. Landing Page Update

Add a download section above the fold on `docs/index.html`:

```
Download PatentForge v0.7.0

[Download for Windows]        (.exe, ~100MB)
[Download for Mac (Beta)]     (.dmg, ~100MB)
[Download for Linux (Beta)]   (.AppImage, ~120MB)

No prerequisites. Everything you need is included.
System requirements: 500MB disk space, 4GB RAM, internet connection (for Anthropic API calls).
```

Download links point to GitHub Release assets:
- `https://github.com/scottconverse/patentforge/releases/download/v0.7.0/PatentForge-0.7.0-Setup.exe`
- `https://github.com/scottconverse/patentforge/releases/download/v0.7.0/PatentForge-0.7.0.dmg`
- `https://github.com/scottconverse/patentforge/releases/download/v0.7.0/PatentForge-0.7.0.AppImage`

---

## 11. What's NOT in v0.7

| Item | Why deferred | Target |
|------|-------------|--------|
| Auto-update checking | Adds scope; manual download is enough for initial release | v0.8 |
| Mac code signing | $99/year; beta label sufficient for now | When demand warrants |
| Linux .deb/.rpm packages | AppImage covers all distros; package manager integration later | v0.8+ |
| Single-binary Python services | PyInstaller AV/cold-start risks; needs dedicated testing | v1.0 (release gate) |
| Docker support in installer | Docker users already have docker-compose | Never (use compose) |
| Multi-user / network deployment | Local-first tool | Post v1.0 |
| Windows service registration | Tray app is sufficient for local use | Post v1.0 |

---

## 12. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Prisma query engine doesn't work inside Node SEA | Medium | High | Test early; fallback is shipping node.exe + Prisma as files |
| NCC fails to bundle NestJS + all deps into single file | Low-Medium | High | Alternative: esbuild bundle; fallback to portable Node |
| Port conflicts on user's machine | Medium | Medium | Tray app detects and shows clear error with port number |
| Windows SmartScreen blocks unsigned installer | High | Medium | Expected for new publishers; user clicks "More info → Run anyway" |
| Mac Gatekeeper blocks unsigned app | High | Medium | Documented; beta label; right-click → Open workaround |
| Python portable runtime path issues on Mac/Linux | Medium | Medium | Test thoroughly in CI; use relative paths from tray app |
| AppImage doesn't show tray icon on some Linux DEs | Medium | Low | Known limitation of some minimal DEs; document supported environments |
| Large installer size (~100MB) | Low | Low | Acceptable for 2026; v1.0 single-binary will be ~60MB |

---

## 13. Success Criteria

v0.7 is done when:

1. A user with no development tools installed can download, install, and run PatentForge on Windows
2. The system tray icon appears, services start, and the browser opens automatically
3. The first-run wizard guides the user through API key setup
4. All existing functionality works (feasibility, prior art, claims, compliance, application generation)
5. Closing the browser does not kill the services; only Quit from the tray does
6. Uninstall cleanly removes the application while preserving user data (with option to delete)
7. Mac and Linux beta builds are downloadable from the landing page and functional
8. CI builds and publishes all three platform installers on tag push
9. 452 unit/component tests + E2E tests continue to pass
10. All documentation artifacts updated (README, CHANGELOG, USER-MANUAL, landing page, CONTRIBUTING)
