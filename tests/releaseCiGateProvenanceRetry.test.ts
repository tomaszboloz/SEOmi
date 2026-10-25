import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { prepareReleaseProvenance } from '../scripts/release-ci-gate-provenance.mjs';

const shaA = 'e'.repeat(40), ver = '0.4.40';
const names = ['SEOmi_aarch64.app.tar.gz', 'SEOmi_x64.app.tar.gz', `SEOmi_${ver}_x64-setup.exe`, `SEOmi_${ver}_x64_en-US.msi`, 'latest.json', `SEOmi_${ver}_aarch64.dmg`, `SEOmi_${ver}_x64.dmg`];

function createMockTransport({ failOnUpload = 0, badDigest = false, noDigest = false } = {}) {
  const assets: Array<{ id: number; name: string; size: number; digest?: string }> = [];
  const bytesMap = new Map<number, Buffer>();
  let nextId = 100, uploadCount = 0;
  const uploads: string[] = [], downloads: number[] = [];
  for (let i = 0; i < names.length; i++) {
    const n = names[i], b = Buffer.from(`pay-${n}-${i}`), id = nextId++;
    const d = badDigest && i === 0 ? `sha256:${'0'.repeat(63)}` : (noDigest ? undefined : `sha256:${createHash('sha256').update(b).digest('hex')}`);
    assets.push({ id, name: n, size: b.length, digest: d });
    bytesMap.set(id, b);
  }
  const fetchImpl = async (url: string | URL | Request, opts?: RequestInit) => {
    const u = String(url), m = opts?.method ?? 'GET';
    if (m === 'DELETE') {
      const id = Number(u.split('/').pop()), idx = assets.findIndex((a) => a.id === id);
      if (idx >= 0) assets.splice(idx, 1);
      return new Response(null, { status: 204 });
    }
    if (m === 'POST') {
      const name = decodeURIComponent(u.split('name=')[1] ?? ''); uploadCount++;
      if (failOnUpload > 0 && uploadCount === failOnUpload) return new Response('err', { status: 503 });
      if (assets.some((a) => a.name === name)) return new Response('{"message":"already_exists"}', { status: 422 });
      const id = nextId++, bodyBuf = Buffer.from(opts?.body ? String(opts.body) : '');
      assets.push({ id, name, size: bodyBuf.length }); bytesMap.set(id, bodyBuf); uploads.push(name);
      return new Response(JSON.stringify({ id, name }), { status: 201 });
    }
    if (u.endsWith('/releases/123')) return new Response(JSON.stringify({ id: 123, tag_name: 'v' + ver, draft: true, target_commitish: shaA, assets: [...assets] }));
    if (u.includes('/releases/assets/')) {
      const id = Number(u.split('/').pop());
      downloads.push(id);
      const b = bytesMap.get(id);
      if (!b) return new Response('missing', { status: 404 });
      return new Response(new Uint8Array(b), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  };
  return { fetchImpl, assets, uploads, downloads, bytesMap, resetFail: () => { failOnUpload = 0; } };
}

function createTempArtifactDir() {
  const dir = mkdtempSync(join(tmpdir(), 'seomi-retry-test-'));
  writeFileSync(join(dir, 'sbom-node.json'), JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.6', components: [{ type: 'library', name: 'pkg-node', version: '1.0.0' }] }));
  writeFileSync(join(dir, 'sbom-rust.json'), JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.3', components: [{ type: 'library', name: 'pkg-rust', version: '1.0.0' }] }));
  return dir;
}

describe('release-ci-gate-provenance retry & idempotence runtime regressions', () => {
  it('handles full rerun idempotence deterministically with fake timers', async () => {
    const dir = createTempArtifactDir();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-25T12:00:00.000Z'));
      const transport = createMockTransport();
      const args = { repository: 'o/r', releaseId: 123, commitSha: shaA, tag: 'v' + ver, token: 'tok', artifactDir: dir, fetchImpl: transport.fetchImpl };
      const res1 = await prepareReleaseProvenance(args);
      expect(res1.inventory.subjects).toHaveLength(7);
      expect(transport.uploads).toEqual(['sbom-node.json', 'sbom-rust.json', 'SHA256SUMS.txt', 'release-provenance.json']);

      // Exact same timestamp produces identical content: all 4 assets reused, 0 re-uploads (total 4)
      const resSame = await prepareReleaseProvenance(args);
      expect(resSame.inventory.subjects).toHaveLength(7);
      expect(transport.uploads).toHaveLength(4);

      // Advanced timestamp produces differing createdAt: only inventory is replaced via DELETE+POST (total 5)
      vi.setSystemTime(new Date('2026-10-25T12:00:05.000Z'));
      const resDiff = await prepareReleaseProvenance(args);
      expect(resDiff.inventory.subjects).toHaveLength(7);
      expect(transport.uploads).toHaveLength(5);
      expect(transport.uploads[4]).toBe('release-provenance.json');
      expect(transport.assets.filter((a) => a.name === 'release-provenance.json')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resumes after partial upload when 3rd upload fails with 503', async () => {
    const dir = createTempArtifactDir();
    try {
      const transport = createMockTransport({ failOnUpload: 3 });
      const args = { repository: 'o/r', releaseId: 123, commitSha: shaA, tag: 'v' + ver, token: 'tok', artifactDir: dir, fetchImpl: transport.fetchImpl };
      await expect(prepareReleaseProvenance(args)).rejects.toThrow('HTTP 503');
      expect(transport.uploads).toEqual(['sbom-node.json', 'sbom-rust.json']);
      transport.resetFail();
      const resResume = await prepareReleaseProvenance(args);
      expect(resResume.inventory.subjects).toHaveLength(7);
      expect(transport.uploads).toEqual(['sbom-node.json', 'sbom-rust.json', 'SHA256SUMS.txt', 'release-provenance.json']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('rejects malformed digest fail-closed (0 uploads/0 downloads) and replaces stale cache on absent digest', async () => {
    const dirBad = createTempArtifactDir(), dirNone = createTempArtifactDir();
    try {
      const tBad = createMockTransport({ badDigest: true });
      await expect(prepareReleaseProvenance({ repository: 'o/r', releaseId: 123, commitSha: shaA, tag: 'v' + ver, token: 'tok', artifactDir: dirBad, fetchImpl: tBad.fetchImpl })).rejects.toThrow('Malformed asset digest');
      expect(tBad.uploads).toHaveLength(0);
      expect(tBad.downloads).toHaveLength(0);

      const tNone = createMockTransport({ noDigest: true });
      const staleName = names[0], staleFile = join(dirNone, staleName);
      const authBytes = tNone.bytesMap.get(tNone.assets[0].id)!;
      writeFileSync(staleFile, Buffer.from('Z'.repeat(authBytes.length)));

      const res = await prepareReleaseProvenance({ repository: 'o/r', releaseId: 123, commitSha: shaA, tag: 'v' + ver, token: 'tok', artifactDir: dirNone, fetchImpl: tNone.fetchImpl });
      expect(res.inventory.subjects).toHaveLength(7);
      expect(tNone.downloads).toHaveLength(7);
      expect(tNone.downloads).toContain(tNone.assets[0].id);
      expect(readFileSync(staleFile).equals(authBytes)).toBe(true);
      expect(tNone.uploads).toHaveLength(4);
    } finally {
      rmSync(dirBad, { recursive: true, force: true });
      rmSync(dirNone, { recursive: true, force: true });
    }
  });
});
