/**
 * Documentation and version consistency audit.
 * Runs as part of the test suite to catch stale docs before push.
 *
 * Checks:
 * 1. All package.json versions match
 * 2. CHANGELOG.md has an entry for the current version
 * 3. README.md contains the current version in the roadmap
 * 4. All required repo files exist
 * 5. Key documentation doesn't reference deprecated services
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const BACKEND_PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/package.json'), 'utf-8'));
const CURRENT_VERSION = BACKEND_PKG.version;

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(ROOT, relativePath));
}

describe('Version Consistency', () => {
  it('all package.json files have the same version', () => {
    const frontendPkg = JSON.parse(readFile('frontend/package.json'));
    const feasibilityPkg = JSON.parse(readFile('services/feasibility/package.json'));

    expect(frontendPkg.version).toBe(CURRENT_VERSION);
    expect(feasibilityPkg.version).toBe(CURRENT_VERSION);
  });

  it('CHANGELOG.md has an entry for the current version', () => {
    const changelog = readFile('CHANGELOG.md');
    expect(changelog).toContain(`## [${CURRENT_VERSION}]`);
  });

  it('README.md roadmap includes the current version as completed', () => {
    const readme = readFile('README.md');
    // Look for the version in a checked roadmap item: - [x] **v0.X.Y**
    const versionPattern = new RegExp(`\\[x\\].*v?${CURRENT_VERSION.replace(/\./g, '\\.')}`);
    expect(readme).toMatch(versionPattern);
  });
});

describe('Required Repo Files', () => {
  const requiredFiles = [
    'LICENSE',
    'README.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    '.gitignore',
    'USER-MANUAL.md',
    'docs/index.html',
    'LEGAL_NOTICE.md',
  ];

  for (const file of requiredFiles) {
    it(`${file} exists`, () => {
      expect(fileExists(file)).toBe(true);
    });
  }
});

describe('Documentation Currency', () => {
  it('README.md does not reference deprecated PatentsView API as current', () => {
    const readme = readFile('README.md');
    // PatentsView can appear in historical context but not as the current data source
    const lines = readme.split('\n');
    for (const line of lines) {
      if (line.includes('PatentsView') && !line.includes('deprecated') && !line.includes('replaces')) {
        // Allow it in the "What PatentForge Does" feature list ONLY if qualified
        if (line.includes('Prior art discovery') || line.includes('via PatentsView')) {
          fail(`README.md still references PatentsView as active: "${line.trim()}"`);
        }
      }
    }
  });

  it('docs/index.html does not reference PatentsView as the active API', () => {
    const html = readFile('docs/index.html');
    // The SVG diagram and feature cards should say "USPTO ODP" not "PatentsView"
    expect(html).not.toContain('>PatentsView<');
  });

  it('CONTRIBUTING.md mentions Playwright E2E tests', () => {
    const contrib = readFile('CONTRIBUTING.md');
    expect(contrib).toContain('Playwright');
    expect(contrib).toContain('playwright test');
  });

  it('CONTRIBUTING.md mentions GitHub Actions CI', () => {
    const contrib = readFile('CONTRIBUTING.md');
    expect(contrib).toContain('GitHub Actions CI');
  });

  it('USER-MANUAL.md mentions API key encryption', () => {
    const manual = readFile('USER-MANUAL.md');
    expect(manual).toContain('encrypted');
  });

  it('USER-MANUAL.md Settings table includes USPTO API Key', () => {
    const manual = readFile('USER-MANUAL.md');
    expect(manual).toContain('USPTO API Key');
  });

  it('.github/workflows/ci.yml exists', () => {
    expect(fileExists('.github/workflows/ci.yml')).toBe(true);
  });

  it('docs/index.html contains current version number', () => {
    const html = readFile('docs/index.html');
    expect(html).toContain(`v${CURRENT_VERSION}`);
  });

  it('docs/index.html mentions API key encryption', () => {
    const html = readFile('docs/index.html');
    expect(html).toContain('encrypt');
  });

  it('docs/index.html mentions claims', () => {
    const html = readFile('docs/index.html');
    expect(html.toLowerCase()).toContain('claims');
  });

  it('DISCUSSIONS-SEED.md references current version', () => {
    const seed = readFile('DISCUSSIONS-SEED.md');
    expect(seed).toContain(`v${CURRENT_VERSION}`);
  });
});
