import express from 'express';
import cors from 'cors';
import { runPipeline } from './pipeline-runner';
import { InventionInput, AnalysisSettings } from './models';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'patentforge-feasibility' });
});

// ── Main analysis endpoint — SSE stream ───────────────────────────────────────
app.post('/analyze', async (req, res) => {
  const { inventionNarrative, settings } = req.body as {
    inventionNarrative: string;
    settings: AnalysisSettings;
  };

  if (!inventionNarrative || typeof inventionNarrative !== 'string') {
    res.status(400).json({ error: 'inventionNarrative is required and must be a string' });
    return;
  }

  if (!settings?.apiKey) {
    res.status(400).json({ error: 'settings.apiKey is required' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Create abort controller for cancellation when the client disconnects.
  // Use res.on('close') not req.on('close') — the request stream closes as soon as
  // the body is consumed, which would abort the pipeline immediately.
  const abortController = new AbortController();
  res.on('close', () => {
    abortController.abort();
  });

  // Helper to send an SSE event
  function sendEvent(eventType: string, data: unknown): void {
    if (res.writableEnded) return;
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // Wrap the narrative in an InventionInput.
  // rawNarrative is set so the pipeline passes it through as-is (no double-labelling).
  const input: InventionInput = {
    title: 'Invention',
    description: inventionNarrative,
    rawNarrative: inventionNarrative,
  };

  // Apply defaults to settings
  const resolvedSettings: AnalysisSettings = {
    model: settings.model || 'claude-opus-4-5',
    researchModel: settings.researchModel,
    maxTokens: settings.maxTokens || 32000,
    interStageDelaySeconds: settings.interStageDelaySeconds ?? 5,
    apiKey: settings.apiKey,
  };

  try {
    const generator = runPipeline(input, resolvedSettings, abortController.signal);
    for await (const event of generator) {
      sendEvent(event.type, event);
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      sendEvent('error', { stage: 0, message: err?.message ?? 'Unknown error' });
    }
  }

  if (!res.writableEnded) {
    res.end();
  }
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10);
app.listen(PORT, () => {
  console.log(`Feasibility service running on port ${PORT}`);
});

export default app;
