import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { assertIndependentProductSources } from '../scripts/release-product-branding.mjs';

describe('independent product source enforcement without external search tools', () => {
  it.each(['OpenSEO', 'open seo', 'OPEN-SEO', 'every-app', 'https://openseo.so/path'])('rejects forbidden reference %s', (reference) => {
    const read = vi.fn(() => Buffer.from(`Product content with ${reference}`));
    expect(() => assertIndependentProductSources(['src/example.ts'], read)).toThrow('Forbidden source branding/reference');
    expect(read).toHaveBeenCalledWith('src/example.ts');
  });

  it.each(['src/main.tsx', 'src-tauri/src/lib.rs', 'mcp-server/src/main.ts', 'public/index.html', 'README.md', 'package.json'])(
    'checks every product source root: %s', (file) => {
      expect(() => assertIndependentProductSources([file], () => Buffer.from('OpenSEO'))).toThrow(file);
    },
  );

  it('preserves the product scope and permits external regression fixtures', () => {
    const read = vi.fn(() => Buffer.from('OpenSEO'));
    expect(() => assertIndependentProductSources(['tests/fixtures.ts', 'scripts/check.mjs', 'docs/history.md'], read)).not.toThrow();
    expect(read).not.toHaveBeenCalled();
  });

  it('accepts independent content and checks references in binary resources too', () => {
    expect(() => assertIndependentProductSources(['src/main.ts'], () => Buffer.from('SEOmi'))).not.toThrow();
    expect(() => assertIndependentProductSources(['public/icon.png'], () => Buffer.from([0, ...Buffer.from('SEOmi')]))).not.toThrow();
    expect(() => assertIndependentProductSources(['public/icon.png'], () => Buffer.from([0, ...Buffer.from('OpenSEO')]))).toThrow('public/icon.png');
  });

  it('fails closed when a tracked product source cannot be read', () => {
    expect(() => assertIndependentProductSources(['src/main.ts'], () => { throw new Error('EACCES'); })).toThrow('EACCES');
  });

  it('reports all forbidden text files across product roots', () => {
    expect(() => assertIndependentProductSources(['src/a.ts', 'public/index.html'], () => Buffer.from('every-app')))
      .toThrow('src/a.ts\npublic/index.html');
  });

  it('runs the complete CLI on a real Git fixture and blocks branding and agent files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seomi-source-policy-'));
    const script = resolve('scripts/release-source-policy.mjs');
    const run = () => spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
    try {
      execFileSync('git', ['-c', 'init.templateDir=', 'init', '--quiet', dir]);
      mkdirSync(join(dir, 'src'));
      writeFileSync(join(dir, 'README.md'), 'SEOmi');
      writeFileSync(join(dir, 'src/main.ts'), 'SEOmi');
      execFileSync('git', ['-C', dir, '-c', 'core.excludesFile=', 'add', 'README.md', 'src/main.ts']);
      expect(run().status).toBe(0);

      writeFileSync(join(dir, 'src/main.ts'), 'every-app');
      const forbiddenContent = run();
      expect(forbiddenContent.status).not.toBe(0);
      expect(forbiddenContent.stderr).toContain('Forbidden source branding/reference');
      expect(forbiddenContent.stdout).not.toContain('Verified');

      writeFileSync(join(dir, 'src/main.ts'), 'SEOmi');
      writeFileSync(join(dir, 'AGENTS.md'), 'instructions');
      execFileSync('git', ['-C', dir, '-c', 'core.excludesFile=', 'add', 'AGENTS.md']);
      const forbiddenAgent = run();
      expect(forbiddenAgent.status).not.toBe(0);
      expect(forbiddenAgent.stderr).toContain('Planning or AI instruction files must not be tracked');
      expect(forbiddenAgent.stdout).not.toContain('Verified');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
