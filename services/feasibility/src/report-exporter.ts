import { marked } from 'marked';
import { StageResult } from './models';

/**
 * Convert a markdown string to a full styled HTML document.
 * Uses the `marked` library for conversion and inlines a light-theme CSS.
 */
export function markdownToStyledHtml(markdown: string, title: string): string {
  // Configure marked for safe output
  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  const body = marked.parse(markdown) as string;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    /* ── Reset & base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 16px;
      line-height: 1.7;
      color: #1a1a1a;
      background: #ffffff;
      padding: 48px 24px;
    }
    /* ── Container ── */
    .report {
      max-width: 820px;
      margin: 0 auto;
    }
    /* ── Headings ── */
    h1 {
      font-size: 2em;
      font-weight: 700;
      border-bottom: 3px solid #1a1a1a;
      padding-bottom: 12px;
      margin-bottom: 24px;
      color: #0d0d0d;
    }
    h2 {
      font-size: 1.5em;
      font-weight: 700;
      margin-top: 40px;
      margin-bottom: 16px;
      color: #1a1a1a;
      border-bottom: 1px solid #d0d0d0;
      padding-bottom: 6px;
    }
    h3 {
      font-size: 1.2em;
      font-weight: 700;
      margin-top: 28px;
      margin-bottom: 12px;
      color: #2a2a2a;
    }
    h4, h5, h6 {
      font-size: 1em;
      font-weight: 700;
      margin-top: 20px;
      margin-bottom: 8px;
    }
    /* ── Paragraphs & inline ── */
    p {
      margin-bottom: 16px;
    }
    strong { font-weight: 700; }
    em     { font-style: italic; }
    /* ── Lists ── */
    ul, ol {
      margin: 0 0 16px 28px;
    }
    li {
      margin-bottom: 6px;
    }
    /* ── Tables ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 0.93em;
    }
    th {
      background: #f0f0f0;
      font-weight: 700;
      text-align: left;
      padding: 10px 14px;
      border: 1px solid #c0c0c0;
    }
    td {
      padding: 8px 14px;
      border: 1px solid #d0d0d0;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background: #f9f9f9;
    }
    /* ── Horizontal rule ── */
    hr {
      border: none;
      border-top: 1px solid #d0d0d0;
      margin: 32px 0;
    }
    /* ── Code (inline only — block code shouldn't appear per prompts) ── */
    code {
      font-family: 'Menlo', 'Consolas', monospace;
      font-size: 0.88em;
      background: #f4f4f4;
      padding: 2px 5px;
      border-radius: 3px;
    }
    pre {
      background: #f4f4f4;
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
      margin-bottom: 16px;
    }
    pre code {
      background: transparent;
      padding: 0;
    }
    /* ── Blockquote ── */
    blockquote {
      border-left: 4px solid #c0c0c0;
      margin: 0 0 16px 0;
      padding: 8px 16px;
      color: #555;
    }
    /* ── Print ── */
    @media print {
      body { padding: 0; font-size: 13px; }
      .report { max-width: 100%; }
      h2 { page-break-before: auto; }
    }
  </style>
</head>
<body>
  <div class="report">
    ${body}
  </div>
</body>
</html>`;
}

/**
 * Build a markdown summary for a single stage result.
 */
export function buildStageSummary(stage: StageResult): string {
  return (
    `# Stage ${stage.stageNumber}: ${stage.stageName}\n\n` +
    `**Model:** ${stage.model}\n` +
    `**Web Search:** ${stage.webSearchUsed ? 'Yes' : 'No'}\n\n` +
    `---\n\n${stage.outputText}`
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
