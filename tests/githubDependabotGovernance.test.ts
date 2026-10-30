import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = readFileSync('.github/dependabot.yml', 'utf8').replace(/\r\n/g, '\n');
const entries = config.split(/^ {2}- package-ecosystem: /m).slice(1);
const entry = (ecosystem: string, directory: string) =>
  entries.find((block) => block.startsWith(`${ecosystem}\n`) && block.includes(`directory: ${directory}\n`)) ?? '';
const register = readFileSync('docs/GOVERNANCE.md', 'utf8');

describe('Dependabot policy (#102)', () => {
  it('covers actions, both npm packages and the Rust crate', () => {
    expect(entries.map((block) => block.split('\n')[0])).toEqual(['github-actions', 'npm', 'npm', 'cargo']);
    for (const [ecosystem, dir] of [['github-actions', '/'], ['npm', '/'], ['npm', '/mcp-server'], ['cargo', '/src-tauri']]) {
      expect(entry(ecosystem, dir), `${ecosystem} ${dir}`).not.toBe('');
    }
  });

  it('limits and groups every update stream', () => {
    for (const block of entries) {
      expect(block).toMatch(/\n {4}open-pull-requests-limit: [1-5]\n/);
      expect(block).toContain('\n    groups:\n');
      expect(block).toContain('interval: weekly');
    }
  });

  it('keeps Tauri major upgrades out of automatic PRs on both sides', () => {
    const major = 'update-types: ["version-update:semver-major"]';
    expect(entry('npm', '/')).toContain(`dependency-name: "@tauri-apps/*"\n        ${major}`);
    expect(entry('cargo', '/src-tauri')).toContain(`dependency-name: "tauri*"\n        ${major}`);
  });
});

describe('governance register (#100)', () => {
  it('lists the admin-only steps as open, not done', () => {
    const manual = register.split('## Remaining manual admin steps')[1] ?? '';
    for (const item of ['sha_pinning_required', 'environment', 'required approvals', 'Code of Conduct']) {
      expect(manual, item).toContain(item);
    }
    expect(manual).toMatch(/- \[ \]/);
    expect(manual).not.toMatch(/- \[x\]/i);
  });
});
