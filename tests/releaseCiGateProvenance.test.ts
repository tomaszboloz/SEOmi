import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  generateArtifactChecksums, buildProvenanceInventory,
  validateProvenanceContract, prepareReleaseProvenance,
} from '../scripts/release-ci-gate-provenance.mjs';

const shaA = 'a'.repeat(40);
const sampleArtifacts = [
  ['SEOmi_aarch64.app.tar.gz', 'darwin-aarch64-app'], ['SEOmi_x64.app.tar.gz', 'darwin-x86_64-app'],
  ['SEOmi_0.4.40_x64-setup.exe', 'windows-x86_64-setup'], ['SEOmi_0.4.40_x64_en-US.msi', 'windows-x86_64-msi'],
  ['latest.json', 'manifest'], ['SEOmi_0.4.40_aarch64.dmg', 'darwin-aarch64-dmg'], ['SEOmi_0.4.40_x64.dmg', 'darwin-x86_64-dmg'],
].map(([name, role], i) => ({ name, role, size: 1000, sha256: String(i + 1).repeat(64) }));

function mockRelease(dir: string, {
  ver = '0.4.40', draft = true, wrongSha = false, missingDmg = false, invalidSbom = false, noSbom = false,
  tamper = false, equalSizeTamper = false, downloadTamper = false, validCache = false, dupAsset = false,
  failOnUpload = 0, noDigest = false, badDigest = false, existingAssets = null as any, bytesMap = null as any,
} = {}) {
  const files = ['SEOmi_aarch64.app.tar.gz', 'SEOmi_x64.app.tar.gz', `SEOmi_${ver}_x64-setup.exe`, `SEOmi_${ver}_x64_en-US.msi`, 'latest.json', `SEOmi_${ver}_aarch64.dmg`, `SEOmi_${ver}_x64.dmg`];
  const targetFiles = missingDmg ? files.filter((f) => !f.endsWith('.dmg')) : files;
  const remoteMap: Map<string, Buffer> = bytesMap ?? new Map(targetFiles.map((n, i) => [n, Buffer.from(`pay-${n}-${i}`)]));
  let nextId = 100, uploadCount = 0; const uploads: string[] = [];
  const assets = existingAssets ?? targetFiles.map((n, i) => {
    const b = remoteMap.get(n)!, d = badDigest && i === 0 ? `sha256:${'0'.repeat(63)}` : (noDigest ? undefined : `sha256:${createHash('sha256').update(b).digest('hex')}`);
    return { id: nextId++, name: n, size: b.length, digest: d };
  });
  if (dupAsset) assets.push({ id: 999, name: assets[0].name, size: assets[0].size, digest: assets[0].digest });
  if (!noSbom) {
    const comp = invalidSbom ? 'invalid' : [{ name: 'dep' }];
    writeFileSync(join(dir, 'sbom-node.json'), JSON.stringify({ bomFormat: 'CycloneDX', components: comp }));
    writeFileSync(join(dir, 'sbom-rust.json'), JSON.stringify({ bomFormat: 'CycloneDX', components: comp }));
  }
  if (tamper) writeFileSync(join(dir, files[0]), 'tampered-stale-different-length');
  if (equalSizeTamper) writeFileSync(join(dir, files[0]), Buffer.alloc(remoteMap.get(files[0])!.length, 90));
  if (validCache) writeFileSync(join(dir, files[0]), remoteMap.get(files[0])!);
  const fetchImpl = async (url: string | URL | Request, opts?: RequestInit) => {
    const u = String(url), m = opts?.method ?? 'GET';
    if (m === 'DELETE') {
      const id = Number(u.split('/').pop()), idx = assets.findIndex((a: any) => a.id === id);
      if (idx >= 0) assets.splice(idx, 1);
      return new Response(null, { status: 204 });
    }
    if (m === 'POST') {
      const name = decodeURIComponent(u.split('name=')[1] ?? ''); uploadCount++;
      if (failOnUpload > 0 && uploadCount === failOnUpload) return new Response('err', { status: 503 });
      if (assets.some((a: any) => a.name === name)) return new Response('{"message":"already_exists"}', { status: 422 });
      const id = nextId++; assets.push({ id, name, size: Number(opts?.body ? String(opts.body).length : 0) });
      remoteMap.set(name, Buffer.from(opts?.body ? String(opts.body) : '')); uploads.push(name);
      return new Response(JSON.stringify({ id, name }), { status: 201 });
    }
    if (u.endsWith('/releases/123')) return new Response(JSON.stringify({ id: 123, tag_name: 'v' + ver, draft, target_commitish: wrongSha ? 'b'.repeat(40) : shaA, assets: [...assets] }));
    const id = Number(u.split('/').pop()), asset = assets.find((a: any) => a.id === id);
    if (!asset) return new Response('missing', { status: 404 });
    const bodyBytes = downloadTamper && asset.name === files[0] ? Buffer.alloc(asset.size, 88) : remoteMap.get(asset.name)!;
    return new Response(new Uint8Array(bodyBytes), { status: 200 });
  };
  return { uploads, fetchImpl, assets, remoteMap };
}

describe('release-ci-gate-provenance runtime & contract verification', () => {
  it('generates checksums and rejects symlink escapes, duplicates, and traversal', () => {
    const dir = join(tmpdir(), `prov-test-${Date.now()}`); mkdirSync(dir, { recursive: true });
    try {
      const f1 = join(dir, 'test.json'), f2 = join(dir, 'app.exe'), outside = join(dir, '..', `out-${Date.now()}.txt`);
      writeFileSync(f1, '{"v":"0.4.40"}'); writeFileSync(f2, 'bin'); writeFileSync(outside, 'out'); symlinkSync(outside, join(dir, 'escape.json'));
      expect(generateArtifactChecksums({ artifactDir: dir, files: ['test.json', 'app.exe'] })).toContain('test.json');
      expect(() => generateArtifactChecksums({ artifactDir: dir, files: ['escape.json'] })).toThrow('Symlink escape');
      expect(() => generateArtifactChecksums({ artifactDir: dir, files: ['test.json', 'test.json'] })).toThrow('Duplicate checksum');
      expect(() => generateArtifactChecksums({ artifactDir: dir, files: ['../secret.txt'] })).toThrow('Path traversal');
      rmSync(outside, { force: true });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('validates provenance contract and detects disk mutations and malformed SBOM arrays', () => {
    const dir = join(tmpdir(), `prov-mut-${Date.now()}`); mkdirSync(dir, { recursive: true });
    try {
      for (const a of sampleArtifacts) writeFileSync(join(dir, a.name), 'content');
      const artifacts = sampleArtifacts.map((a) => ({ ...a, size: 7, sha256: 'a'.repeat(64) }));
      const inv = buildProvenanceInventory({ repository: 'o/r', tag: 'v0.4.40', commitSha: shaA, version: '0.4.40', artifacts });
      const checksums = artifacts.map((a) => `${a.sha256}  ${a.name}`).join('\n');
      writeFileSync(join(dir, artifacts[0].name), 'tampered content');
      expect(validateProvenanceContract({ inventory: inv, checksumsContent: checksums, sbomNode: { bomFormat: 'CycloneDX', components: [{ name: 'pkg' }] }, sbomRust: { bomFormat: 'CycloneDX', components: [] }, expectedSha: shaA, expectedVersion: '0.4.40', artifactDir: dir })).toBe(false);
      expect(() => validateProvenanceContract({ inventory: inv, checksumsContent: checksums, sbomNode: { bomFormat: 'CycloneDX', components: {} }, sbomRust: { bomFormat: 'CycloneDX', components: [] }, expectedSha: shaA, expectedVersion: '0.4.40' })).toThrow('components must be an array');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('rejects negatives with ZERO uploads and no mutations on wrong SHA/public', async () => {
    const cases = [
      { name: 'noSbom', opts: { noSbom: true }, err: 'Missing required Node CycloneDX SBOM' },
      { name: 'invalidSbom', opts: { invalidSbom: true }, err: 'components must be an array' },
      { name: 'wrongSha', opts: { wrongSha: true }, err: 'target_commitish mismatch' },
      { name: 'public', opts: { draft: false }, err: 'Refusing non-draft release' },
      { name: 'missingDmg', opts: { missingDmg: true }, err: 'Missing release asset' },
      { name: 'tamperSize', opts: { tamper: true }, err: 'Cache tamper detected' },
      { name: 'equalSizeTamper', opts: { equalSizeTamper: true }, err: 'Cache tamper detected' },
      { name: 'downloadTamper', opts: { downloadTamper: true }, err: 'Downloaded asset digest mismatch' },
      { name: 'dupAsset', opts: { dupAsset: true }, err: 'Duplicate remote release asset' },
      { name: 'badDigest', opts: { badDigest: true }, err: 'Malformed asset digest' },
    ];
    for (const c of cases) {
      const dir = join(tmpdir(), `prov-neg-${c.name}-${Date.now()}`); mkdirSync(dir, { recursive: true });
      try {
        const { uploads, fetchImpl, assets } = mockRelease(dir, c.opts); const initCount = assets.length;
        await expect(prepareReleaseProvenance({ repository: 'o/r', releaseId: 123, commitSha: shaA, tag: 'v0.4.40', token: 'tok', artifactDir: dir, fetchImpl })).rejects.toThrow(c.err);
        expect(uploads).toHaveLength(0);
        if (c.opts.draft === false || c.opts.wrongSha) expect(assets).toHaveLength(initCount);
      } finally { rmSync(dir, { recursive: true, force: true }); }
    }
  });

  it('handles idempotence: two consecutive runs, partial retry, 3rd upload failure retry, absent digest', async () => {
    const dir = join(tmpdir(), `prov-idem-${Date.now()}`); mkdirSync(dir, { recursive: true });
    try {
      const t1 = mockRelease(dir);
      const res1 = await prepareReleaseProvenance({ repository: 'o/r', releaseId: 123, commitSha: shaA, tag: 'v0.4.40', token: 'tok', artifactDir: dir, fetchImpl: t1.fetchImpl });
      expect(res1.inventory.subjects).toHaveLength(7);
      const res2 = await prepareReleaseProvenance({ repository: 'o/r', releaseId: 123, commitSha: shaA, tag: 'v0.4.40', token: 'tok', artifactDir: dir, fetchImpl: t1.fetchImpl });
      expect(res2.inventory.subjects).toHaveLength(7);

      const t2 = mockRelease(dir, { failOnUpload: 3 });
      await expect(prepareReleaseProvenance({ repository: 'o/r', releaseId: 123, commitSha: shaA, tag: 'v0.4.40', token: 'tok', artifactDir: dir, fetchImpl: t2.fetchImpl })).rejects.toThrow('HTTP 503');
      const t2Resume = mockRelease(dir, { existingAssets: t2.assets, bytesMap: t2.remoteMap });
      const resPartial = await prepareReleaseProvenance({ repository: 'o/r', releaseId: 123, commitSha: shaA, tag: 'v0.4.40', token: 'tok', artifactDir: dir, fetchImpl: t2Resume.fetchImpl });
      expect(resPartial.inventory.subjects).toHaveLength(7);

      const t3 = mockRelease(dir, { noDigest: true });
      const resNoDigest = await prepareReleaseProvenance({ repository: 'o/r', releaseId: 123, commitSha: shaA, tag: 'v0.4.40', token: 'tok', artifactDir: dir, fetchImpl: t3.fetchImpl });
      expect(resNoDigest.inventory.subjects).toHaveLength(7);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('verifies release workflow provenance integration contract and strict permissions', () => {
    const wf = readFileSync('.github/workflows/release.yml', 'utf8').replace(/\r\n/g, '\n');
    expect(wf.split('jobs:')[0]).toContain('permissions:\n  contents: read');
    const pJob = wf.split('publish-release:')[1];
    expect(pJob).toContain('id-token: write');
    expect(pJob).toContain('attestations: write');
    expect(pJob).toContain('actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2');
    expect(pJob).toContain('subject-checksums: SHA256SUMS.txt');
    expect(pJob).toContain('npm ci --ignore-scripts');
    expect(pJob).toContain('node scripts/release-ci-gate-provenance.mjs --prepare-provenance');
  });
});
