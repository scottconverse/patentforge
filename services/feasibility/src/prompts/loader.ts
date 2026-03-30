import * as fs from 'fs';
import * as path from 'path';

let commonRules: string | null = null;
const stagePrompts: Map<number, string> = new Map();

export function loadSystemPrompt(stageNumber: number): string {
  if (!commonRules) {
    commonRules = fs.readFileSync(path.join(__dirname, 'common-rules.md'), 'utf-8');
  }
  if (!stagePrompts.has(stageNumber)) {
    const content = fs.readFileSync(path.join(__dirname, `stage-${stageNumber}.md`), 'utf-8');
    stagePrompts.set(stageNumber, content);
  }
  return commonRules + '\n\n' + stagePrompts.get(stageNumber)!;
}
