import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { isPathWithin } from '../scripts/release-artifact-paths.mjs';
import { generateArtifactChecksums } from '../scripts/release-ci-gate-provenance.mjs';
import { fetchOrVerifyAsset } from '../scripts/release-ci-gate-provenance-upload.mjs';

describe('canonical release artifact path containment', () => {
  it.each([
    ['/artifacts', '/artifacts/app.exe', true],
    ['/artifacts/', '/artifacts/nested/app.exe', true],
    ['/artifacts', '/artifacts', true],
    ['/', '/app.exe', true],
    ['/artifacts', '/artifacts/../outside/app.exe', false],
    ['/artifacts', '/artifacts-sibling/app.exe', false],
    ['/artifacts', '/app.exe', false],
    ['relative', '/relative/app.exe', false],
    ['/artifacts', 'relative/app.exe', false],
  ])('POSIX %s → %s is %s', (root, candidate, expected) => {
    expect(isPathWithin(root, candidate, posix)).toBe(expected);
  });

  it.each([
    ['C:\\artifacts', 'C:\\artifacts\\app.exe', true],
    ['C:\\artifacts\\', 'C:/artifacts/nested/app.exe', true],
    ['C:\\Artifacts', 'c:\\artifacts\\app.exe', true],
    ['C:\\artifacts', 'C:\\artifacts', true],
    ['C:\\', 'C:\\app.exe', true],
    ['C:\\artifacts', 'C:\\artifacts\\..\\outside\\app.exe', false],
    ['C:\\artifacts', 'C:\\artifacts-sibling\\app.exe', false],
    ['C:\\artifacts', 'C:\\app.exe', false],
    ['C:\\artifacts', 'D:\\artifacts\\app.exe', false],
    ['C:\\artifacts', 'C:artifacts\\app.exe', false],
    ['\\\\server\\share\\artifacts', '\\\\server\\share\\artifacts\\app.exe', true],
    ['\\\\server\\share\\artifacts', '\\\\server\\other\\artifacts\\app.exe', false],
    ['\\\\server\\share\\artifacts', '\\\\other\\share\\artifacts\\app.exe', false],
  ])('Windows %s → %s is %s', (root, candidate, expected) => {
    expect(isPathWithin(root, candidate, win32)).toBe(expected);
  });

  it('uses native canonical paths for checksums and cached downloads, rejecting a sibling symlink', async () => {
    const base = mkdtempSync(join(tmpdir(), 'seomi-containment-'));
    try {
      const dir = join(base, 'artifacts'), sibling = join(base, 'artifacts-sibling');
      mkdirSync(dir); mkdirSync(sibling);
      const bytes = 'signed-artifact', digest = createHash('sha256').update(bytes).digest('hex');
      writeFileSync(join(dir, 'app.exe'), bytes);
      writeFileSync(join(sibling, 'app.exe'), bytes);
      symlinkSync(sibling, join(dir, 'escape'), 'junction');
      expect(generateArtifactChecksums({ artifactDir: dir, files: ['app.exe'] })).toBe(`${digest}  app.exe\n`);
      expect(() => generateArtifactChecksums({ artifactDir: dir, files: ['escape/app.exe'] })).toThrow('Symlink escape');
      const fetchImpl = vi.fn<typeof fetch>();
      const options = {
        asset: { id: 123, name: 'app.exe', size: bytes.length, digest: `sha256:${digest}` },
        artifactDir: dir, realDir: realpathSync(dir), headers: {}, apiUrl: 'https://api.github.com',
        repository: 'owner/repo', fetchImpl,
      };
      await expect(fetchOrVerifyAsset({ ...options, name: 'app.exe' })).resolves.toEqual({ sha256: digest, size: bytes.length });
      await expect(fetchOrVerifyAsset({ ...options, name: 'escape/app.exe' })).rejects.toThrow('Path escape');
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { rmSync(base, { recursive: true, force: true }); }
  });
});
