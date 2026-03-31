# GitHub Discussions — Seed Posts

These are the initial posts to create when GitHub Discussions is enabled on the PatentForge repo.

---

## Category: Announcements (pin this post)

### Title: Welcome to PatentForge — What It Is and What's Coming

**Body:**

Hey everyone! PatentForge is now open source.

**What it does:** PatentForge is a self-hosted web app that helps inventors explore the patent landscape for their ideas using AI. You describe your invention, and it runs a 6-stage analysis — restating your idea in technical language, searching for related patents, mapping it against patent law requirements, and assembling everything into a structured report you can take to a patent attorney.

**What it doesn't do:** This is a research tool, not a legal service. The author isn't a lawyer, the AI isn't a lawyer, and none of the output is legal advice. It's designed to help you prepare for a meeting with a real patent attorney — not replace one.

**Current status (v0.3.4):**
- 6-stage AI analysis pipeline with real-time streaming
- Prior art discovery via USPTO Open Data Portal with improved relevance scoring
- Patent claims viewer — lazy-load actual claims text from USPTO Documents API
- API keys encrypted at rest (AES-256-GCM)
- Export to HTML, Word (.docx with full formatting), Markdown, and CSV
- Cost transparency with configurable cost cap
- Optional Bearer token authentication for network deployments
- 187 automated tests (Jest + Vitest + Playwright E2E) with GitHub Actions CI
- Resume from interruption, individual stage re-run
- Legal guardrails — clickwrap, embedded disclaimers, watermarked exports, CC BY-SA prompt licensing

**What's next:**
- v0.4 — AI-assisted claim drafting research
- v0.5 — Compliance review tooling
- v0.6 — Full application document assembly

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

I'm planning the v0.3-v0.6 roadmap and would love input from people who've actually been through the patent process.

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

### Title: v0.3.4 — Scoring, Encryption, CI, Auth

**Body:**

Five improvements focused on security, code quality, and developer experience:

1. **Smarter prior art scoring** — common patent stop-words ("comprising", "wherein", "apparatus", etc.) are now filtered out. Title matches score 2x higher than abstract matches. Less noise, more signal.

2. **API key encryption at rest** — your Anthropic and USPTO API keys are now encrypted with AES-256-GCM using a machine-derived key before being stored in the database. The plaintext key never hits disk.

3. **Prompt integrity checking** — SHA-256 hashes of all prompt files are computed at startup and logged. If a prompt file is modified while the service is running, you'll get a warning. Hashes are also available on the `/health` endpoint.

4. **GitHub Actions CI** — automated test pipeline runs Jest (backend), Vitest (frontend), and a full build check on every push and PR.

5. **Optional authentication** — set the `PATENTFORGE_TOKEN` environment variable to require Bearer token auth on all API requests. Off by default for single-user local installs, available for anyone running PatentForge on a network.

187 total tests across 3 layers. The foundation is solid for v0.4 (claim drafting).
