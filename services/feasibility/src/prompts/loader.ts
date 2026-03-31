import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

let commonRules: string | null = null;
const stagePrompts: Map<number, string> = new Map();

/** SHA-256 hashes of prompt files at first load, for drift detection. */
const promptHashes: Map<string, string> = new Map();

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex').slice(0, 16);
}

/**
 * Load and cache a prompt file with integrity checking.
 * Logs the hash on first load so operators can verify prompts haven't been tampered with.
 */
function loadFile(filePath: string, label: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  const hash = sha256(content);
  const existingHash = promptHashes.get(label);

  if (!existingHash) {
    // First load — record hash
    promptHashes.set(label, hash);
    console.log(`[Prompts] Loaded ${label} (sha256: ${hash}, ${content.length} bytes)`);
  } else if (existingHash !== hash) {
    // Drift detected — file changed since first load
    console.warn(
      `[Prompts] WARNING: ${label} has changed since startup! ` +
      `Expected hash ${existingHash}, got ${hash}. ` +
      `Prompt files should not be modified while the service is running.`,
    );
    promptHashes.set(label, hash);
  }

  return content;
}

export function loadSystemPrompt(stageNumber: number): string {
  if (!commonRules) {
    commonRules = loadFile(
      path.join(__dirname, 'common-rules.md'),
      'common-rules.md',
    );
  }
  if (!stagePrompts.has(stageNumber)) {
    const content = loadFile(
      path.join(__dirname, `stage-${stageNumber}.md`),
      `stage-${stageNumber}.md`,
    );
    stagePrompts.set(stageNumber, content);
  }
  return commonRules + '\n\n' + stagePrompts.get(stageNumber)!;
}

/** Get all recorded prompt hashes (for health check / diagnostics). */
export function getPromptHashes(): Record<string, string> {
  return Object.fromEntries(promptHashes);
}
