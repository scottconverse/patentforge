# PatentForge User Manual

A step-by-step guide for using PatentForge to research and prepare for a patent consultation.

---

## What Is PatentForge?

PatentForge is a web application that runs on your computer. You describe your invention, and it uses artificial intelligence (Anthropic's Claude) to explore the patent landscape — searching for related patents, identifying potential issues under patent law, and organizing findings into a readable report.

**The goal:** Help you walk into a meeting with a patent attorney prepared — with your invention clearly described, related prior art identified, and the right questions already on the table. PatentForge does the homework so you can make the most of your attorney's time.

**What it is not:** PatentForge is not a lawyer, not a legal service, and does not provide legal advice. The author of this tool is not a lawyer. The AI systems that generate the analysis are not lawyers. No attorney-client relationship is created by using this tool. AI-generated analysis may contain errors, omissions, or hallucinated references. Patent law is complex, and decisions about whether and how to file should always be made with a registered patent attorney or patent agent.

**What it costs:** Each analysis run costs approximately $0.75 to $3.00 in Anthropic API fees (the cost of the AI processing).

---

## Getting Started

### What You Need

1. **A computer** running Windows, macOS, or Linux
2. **Node.js** — a free program that runs JavaScript applications. Download it from [nodejs.org](https://nodejs.org/). Choose the "LTS" (Long Term Support) version. During installation, accept all defaults.
3. **An Anthropic API key** — this is like a password that lets PatentForge use the Claude AI. Get one at [console.anthropic.com](https://console.anthropic.com/). You'll need to create a free account and add a small amount of credit (even $5 is enough for several runs).

### Installation

1. **Download PatentForge** from [GitHub](https://github.com/scottconverse/patentforge) — click the green "Code" button, then "Download ZIP." Unzip the folder.

2. **Open a terminal** (Command Prompt on Windows, Terminal on Mac/Linux) and navigate to the PatentForge folder:
   ```
   cd path/to/patentforge
   ```

3. **Install the software** by running these commands one at a time:
   ```
   cd backend
   npm install
   cd ..

   cd services/feasibility
   npm install
   cd ../..

   cd frontend
   npm install
   cd ..
   ```
   This downloads all the libraries PatentForge needs. It may take a few minutes.

4. **Set up the database:**
   ```
   cd backend
   npx prisma migrate deploy
   npx prisma generate
   cd ..
   ```

5. **Start PatentForge:**
   - On Windows: double-click `PatentForge.bat`
   - On Mac/Linux: open three terminal windows and run:
     - Terminal 1: `cd backend && npm run build && npm run start`
     - Terminal 2: `cd services/feasibility && npm run build && npm run start`
     - Terminal 3: `cd frontend && npm run dev`

6. **Open your browser** and go to http://localhost:8080

You should see the PatentForge home screen. On first launch, a **Terms of Use** dialog will appear. Read it carefully — it explains that PatentForge is a research tool, not a legal service — then click "I Understand and Agree" to continue.

### First-Time Setup: Enter Your API Key

Before you can run any analysis, you need to enter your Anthropic API key:

1. Click the **gear icon** (Settings) in the top navigation bar
2. In the **Anthropic API Key** field, paste your API key (it starts with `sk-ant-`)
3. Leave the other settings at their defaults (they work well for most runs)
4. Click **Save Settings**

You only need to do this once. The key is saved in your local database.

---

## Using PatentForge

### Step 1: Create a New Project

1. From the home screen, click **"New Project"**
2. Enter a **title** for your invention (e.g., "AI-Powered Soil Moisture Sensor Network")
3. Click **Create**

You'll be taken to the project detail page.

### Step 2: Fill In the Invention Form

The invention form has 11 fields. Only **Title** and **Description** are required, but the more detail you provide, the better the research output will be.

| Field | What to Write |
|-------|--------------|
| **Title** | A short, descriptive name for your invention |
| **Description** | A detailed explanation of what your invention is and how it works. Be as specific as possible. |
| **Problem Solved** | What problem does your invention solve? Why do people need it? |
| **How It Works** | Technical details about how the invention operates |
| **AI Components** | If your invention uses artificial intelligence or machine learning, describe those parts here |
| **3D Print Components** | If your invention involves 3D-printed parts or physical designs, describe them here |
| **What Is Novel** | What do you believe is new about your invention? What hasn't been done before? |
| **Current Alternatives** | What solutions already exist for the same problem? How is yours different? |
| **What Is Built** | Have you built a prototype? Is this just an idea, or is there working code/hardware? |
| **What To Protect** | What specific aspects of your invention do you want patent protection for? |
| **Additional Notes** | Anything else relevant that doesn't fit in the other fields |

Click **Save Draft** to save your work without starting the analysis.

### Step 3: Run the Analysis

1. Click **"Run Feasibility"** on the project detail page
2. A **cost estimate** dialog will appear showing:
   - **Token cost** — estimated cost for the AI processing
   - **Web search cost** — approximately $0.15 for real-time patent and product research
   - **Total estimated cost** — combined estimate
3. Click **"Run Analysis"** to confirm and start

The analysis runs through 6 stages sequentially. You'll see:
- A **stage progress panel** on the left showing which stage is active
- **Real-time streaming text** on the right as the AI writes its findings
- Each stage takes 1-3 minutes depending on the complexity of your invention

**The 6 stages are:**

1. **Technical Intake & Restatement** — Restates your invention in precise technical language
2. **Prior Art Research** — Searches the web for existing patents, papers, and products
3. **Patentability Assessment** — Maps your invention against the main patent law requirements (35 USC 101, 102, 103, 112)
4. **Deep Dive Analysis** — Detailed examination of domain-specific patent dynamics
5. **IP Landscape Assessment** — Presents filing indicators, cost factors, and open questions
6. **Consolidated Report** — Assembles all findings into a single structured document

### Step 4: Review the Results

When the analysis completes, you'll see:
- The **consolidated report** rendered in the main panel
- **Individual stage outputs** accessible by clicking each stage in the sidebar
- **Total API cost** shown below the stage list

**Remember:** This output is structured research to help you prepare for a conversation with a patent professional. It is not a legal opinion. The AI's findings may contain errors, omissions, or hallucinated references — including fabricated patent numbers and inaccurate legal citations. All findings should be verified by a qualified patent attorney before making any decisions.

### Step 5: Export Your Report

Click the download buttons at the top of the report:

- **Download HTML** — a styled, printable report you can share with your attorney
- **Download Word** — a .docx file you can open in Microsoft Word or Google Docs
- **Download** (on individual stages) — saves that stage's output as a .md (Markdown) file

Files are saved to your browser's Downloads folder.

---

## Prior Art Discovery

When you run an analysis, PatentForge automatically searches for related patents using the PatentsView API. Results appear in a **Prior Art panel** on the project detail page.

Each result shows:
- **Patent title** and number
- **Relevance score** (a colored bar showing textual similarity to your invention description)
- **Abstract snippet** explaining what the patent covers
- A **link to Google Patents** where you can read the full patent

The prior art results are also provided as context to Stage 2, so the AI considers them during its research.

**Note:** This is a keyword-based search of U.S. patents. It is not exhaustive. A patent attorney will typically conduct a more thorough professional search using specialized databases.

**Note (v0.3.1):** Structured prior art search now uses the USPTO Open Data Portal (ODP). To enable it, add your ODP API key in Settings. The key is optional — without it, the AI analysis still uses web search for prior art research in Stage 2. To get an ODP API key (free), register at [data.uspto.gov](https://data.uspto.gov/myodp). This requires a USPTO.gov account with ID.me identity verification.

### Clicking a Prior Art Result

When prior art results are available, click any patent card to open a **detail drawer** on the right side of the screen. The drawer shows:

- **Patent number** (linked to Google Patents)
- **Filing date** and **grant date**
- **Assignee(s)** — who owns the patent
- **Inventor(s)**
- **CPC classifications** — the patent categories assigned by the patent office
- **Full claims text** — expandable section showing all patent claims

If the patent data service is unavailable, the drawer will show a message with a link to view the patent directly on Google Patents.

### Exporting Prior Art as CSV

When a prior art search is complete, click the **Export CSV** button at the top of the Prior Art panel. This downloads a spreadsheet with columns for patent number, title, dates, assignees, inventors, CPC codes, relevance score, and abstract. You can open this file in Excel or Google Sheets.

---

## Re-running Individual Stages

After a completed analysis, you can re-run any individual stage without restarting the entire pipeline. This is useful if you've updated your invention description and want to see how a specific stage's output changes.

1. Look at the **stage list** in the left sidebar
2. Each completed stage shows a small **"re-run"** link on the right side
3. Click "re-run" on the stage you want to re-run
4. PatentForge creates a new version of the analysis, copies all stages before your selected stage, and re-runs from that point through Stage 6

**Note:** Re-running a stage also re-runs all stages after it, because each stage depends on the output of the stages before it. For example, re-running Stage 3 will also re-run Stages 4, 5, and 6. The cost estimate reflects only the stages being re-run.

Your previous analysis version is preserved — you can view it in the **History** section.

---

## Settings

Access settings via the gear icon in the navigation bar.

| Setting | What It Does | Default |
|---------|-------------|---------|
| **Anthropic API Key** | Your Claude API key (required) | — |
| **Default Model** | Which AI model to use for most stages | claude-sonnet-4-20250514 |
| **Research Model** | Optional cheaper model for the research stage | — |
| **Max Tokens** | Maximum length of each stage's response | 32,000 |
| **Inter-Stage Delay** | Seconds to wait between stages (prevents rate limiting) | 5 |

**Model choices:**
- **Sonnet** (default) — good balance of quality and cost
- **Opus** — highest quality, slowest, most expensive
- **Haiku** — fastest and cheapest, lower quality

---

## Troubleshooting

### "No API key configured"

You need to enter your Anthropic API key in Settings before running an analysis. See the "First-Time Setup" section above.

### Analysis stops mid-way

If the analysis stops before completing all 6 stages (due to a network issue, rate limit, or browser crash):
1. Go back to the project detail page
2. You'll see a **"Resume"** button next to the partially completed run
3. Click Resume — it picks up from the last completed stage
4. The cost estimate will reflect only the remaining stages

### "Rate limited" error

This means you've sent too many requests to the Anthropic API in a short time. PatentForge automatically retries with increasing delays (60s, 90s, 120s). If it still fails:
- Wait 5 minutes and try again
- Increase the "Inter-Stage Delay" in Settings to 10 or 15 seconds

### The page shows a loading spinner that won't stop

Try refreshing the page (F5 or Ctrl+R). If a pipeline was running when the page loaded, PatentForge detects the stale state and shows you the partial results with a Resume option.

### I can't connect to http://localhost:8080

Make sure all three services are running:
- Backend on port 3000
- Feasibility service on port 3001
- Frontend on port 8080

If you used `PatentForge.bat`, check that the terminal windows are open and not showing errors.

---

## Glossary

| Term | Plain English Definition |
|------|------------------------|
| **API key** | A password-like code that lets PatentForge access the Claude AI service |
| **Claude** | The AI model made by Anthropic that PatentForge uses for analysis |
| **LLM** | Large Language Model — the type of AI that powers Claude |
| **Patent** | A legal document that gives you the exclusive right to make, use, or sell an invention for a limited time |
| **Prior art** | Any evidence that something similar to your invention already existed before you invented it |
| **SSE** | Server-Sent Events — the technology that lets you see the AI's response appear word by word |
| **35 USC 101** | The law defining what kinds of things can be patented |
| **35 USC 102** | The law requiring that your invention be new (novel) |
| **35 USC 103** | The law requiring that your invention not be an obvious combination of known things |
| **35 USC 112** | The law requiring that a patent application clearly describe how to make and use the invention |
| **Token** | A small unit of text (roughly 3/4 of a word) used to measure AI processing costs |

---

*PatentForge is a research tool, not a legal service. The author of this tool is not a lawyer. The AI systems that generate the analysis are not lawyers. No attorney-client relationship is created by using this tool. It does not provide legal advice. Always consult a registered patent attorney or patent agent before making patent filing decisions.*
