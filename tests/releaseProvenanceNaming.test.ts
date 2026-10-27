import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareReleaseProvenance } from '../scripts/release-ci-gate-provenance.mjs';
import { mockRelease } from './releaseProvenanceFixtures';

const sha = 'a'.repeat(40);
const prepare = (dir: string, ver: string, fetchImpl: ReturnType<typeof mockRelease>['fetchImpl']) =>
  prepareReleaseProvenance({ repository: 'o/r', releaseId: 123, commitSha: sha, tag: `v${ver}`, token: 'test', artifactDir: dir, fetchImpl });

describe('provenance naming contract for actual Tauri release output', () => {
  it.each(['0.4.41', '0.4.42'])('accepts versioned macOS archives produced for %s', async ver => {
    const dir = mkdtempSync(join(tmpdir(), 'provenance-versioned-'));
    try {
      const mock = mockRelease(dir, { ver, versionedMac: true });
      const result = await prepare(dir, ver, mock.fetchImpl);
      expect(result.inventory.subjects).toHaveLength(7);
      expect(result.inventory.subjects).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: `SEOmi_${ver}_aarch64.app.tar.gz`, role: 'darwin-aarch64-app' }),
        expect.objectContaining({ name: `SEOmi_${ver}_x64.app.tar.gz`, role: 'darwin-x86_64-app' }),
      ]));
      expect(mock.uploads).toHaveLength(4);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('preserves the legacy unversioned archive contract', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'provenance-legacy-'));
    try {
      const mock = mockRelease(dir, { ver: '0.4.41' });
      const result = await prepare(dir, '0.4.41', mock.fetchImpl);
      expect(result.inventory.subjects.map((subject: { name: string }) => subject.name))
        .toEqual(expect.arrayContaining(['SEOmi_aarch64.app.tar.gz', 'SEOmi_x64.app.tar.gz']));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('records versioned originals when byte-identical legacy aliases also exist', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'provenance-aliases-'));
    try {
      const mock = mockRelease(dir, { ver: '0.4.41', versionedMac: true });
      ['aarch64', 'x64'].forEach((arch, index) => {
        const bytes = mock.remoteMap.get(`SEOmi_0.4.41_${arch}.app.tar.gz`)!;
        const name = `SEOmi_${arch}.app.tar.gz`;
        mock.remoteMap.set(name, bytes);
        mock.assets.push({ id: 900 + index, name, size: bytes.length, digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}` });
      });
      const result = await prepare(dir, '0.4.41', mock.fetchImpl);
      expect(result.inventory.subjects.map((subject: { name: string }) => subject.name))
        .toEqual(expect.arrayContaining(['SEOmi_0.4.41_aarch64.app.tar.gz', 'SEOmi_0.4.41_x64.app.tar.gz']));
      expect(result.inventory.subjects).toHaveLength(7);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('rejects incomplete versioned inventory without any provenance uploads', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'provenance-missing-'));
    try {
      const mock = mockRelease(dir, { ver: '0.4.41', versionedMac: true });
      const index = mock.assets.findIndex((asset: { name: string }) => asset.name === 'SEOmi_0.4.41_x64.app.tar.gz');
      mock.assets.splice(index, 1);
      await expect(prepare(dir, '0.4.41', mock.fetchImpl)).rejects.toThrow('Missing release asset');
      expect(mock.uploads).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
