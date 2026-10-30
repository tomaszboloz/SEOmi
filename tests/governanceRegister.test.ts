import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, basename } from 'node:path';
import { describe, expect, it } from 'vitest';

const register = readFileSync('docs/GOVERNANCE.md', 'utf8').replace(/\r\n/g, '\n');
const section = (title: string) => register.split(`## ${title}\n`)[1]?.split('\n## ')[0] ?? '';
const workflows = readdirSync('.github/workflows').map((name) => readFileSync(`.github/workflows/${name}`, 'utf8')).join('\n');

/** True when a literal path exists or a single-segment `*` pattern matches at least one file. */
const pathMatches = (pattern: string): boolean => {
  if (!pattern.includes('*')) return existsSync(pattern);
  const dir = dirname(pattern);
  if (!existsSync(dir)) return false;
  const re = new RegExp(`^${basename(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return readdirSync(dir).some((name) => re.test(name));
};

describe('governance register stays tied to real files (#100)', () => {
  const rows = section('File-level controls (issues #101, #102)').split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| Control') && !line.startsWith('| ---'));

  it('every control row names files and a guard test that exist', () => {
    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows) {
      const [, files, guard] = row.split(' | ');
      const paths = [...`${files} ${guard}`.matchAll(/`([^`\s]+\/[^`\s]+)`/g)].map((m) => m[1]);
      expect(paths.length, row).toBeGreaterThan(0);
      for (const path of paths) expect(pathMatches(path), path).toBe(true);
    }
  });

  it('path matcher rejects missing files, directories and patterns', () => {
    expect(pathMatches('tests/noSuchGuard.test.ts')).toBe(false);
    expect(pathMatches('no-such-dir/*.ts')).toBe(false);
    expect(pathMatches('tests/zzzNothing*.test.ts')).toBe(false);
    expect(pathMatches('tests/releaseCiGate*.test.ts')).toBe(true);
  });

  it('pin evidence lists every pinned action and version used by the workflows', () => {
    const evidence = section('Action pin evidence (issue #102)');
    const pins = [...workflows.matchAll(/uses: ([\w.-]+\/[\w.-]+)@[0-9a-f]{40} # (\S+)/g)];
    expect(pins.length).toBeGreaterThan(0);
    for (const [, action, version] of pins) expect(evidence, action).toContain(`\`${action}\` ${version}`);
  });

  it('keeps owner-only settings out of the API and records them as owner actions', () => {
    const owner = section('Owner-only repository settings (issue #100)');
    for (const item of ['Branch protection', 'Tag ruleset', 'Actions permissions', 'Required approvals', 'Release environment', 'sha_pinning_required']) {
      expect(owner, item).toContain(item);
    }
    expect(owner).toContain('do not change them through the API');
    expect(owner).not.toMatch(/- \[x\]/i);
  });
});
