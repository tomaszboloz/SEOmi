import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareReleaseProvenance } from '../scripts/release-ci-gate-provenance.mjs';

describe('remote-byte provenance snapshot', () => {
  it('refuses cache changes after successful download before signing or uploading metadata', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'seomi-provenance-snapshot-'));
    try {
      for (const name of ['sbom-node.json', 'sbom-rust.json']) {
        writeFileSync(join(dir, name), JSON.stringify({ bomFormat: 'CycloneDX', components: [] }));
      }
      const ver = '0.4.41', sha = 'a'.repeat(40);
      const names = ['SEOmi_aarch64.app.tar.gz', 'SEOmi_x64.app.tar.gz', `SEOmi_${ver}_x64-setup.exe`,
        `SEOmi_${ver}_x64_en-US.msi`, 'latest.json', `SEOmi_${ver}_aarch64.dmg`, `SEOmi_${ver}_x64.dmg`];
      const bytes = names.map((_, i) => Buffer.from(`asset-${i}`));
      const assets = names.map((name, i) => ({ id: i + 1, name, size: bytes[i].length,
        digest: `sha256:${createHash('sha256').update(bytes[i]).digest('hex')}` }));
      const mutations: string[] = [];
      let downloads = 0;
      const fetchImpl = async (input: string | URL | Request, options?: RequestInit) => {
        const url = new URL(String(input));
        if (options?.method && options.method !== 'GET') {
          mutations.push(options.method); return new Response('{}', { status: 201 });
        }
        if (url.pathname === '/repos/o/r/releases/123') return new Response(JSON.stringify({ id: 123, draft: true,
          tag_name: `v${ver}`, target_commitish: sha, assets }));
        const match = url.pathname.match(/^\/repos\/o\/r\/releases\/assets\/([0-9]+)$/);
        if (!match) return new Response('missing', { status: 404 });
        const id = Number(match[1]); downloads++;
        if (id === 7) writeFileSync(join(dir, names[0]), Buffer.alloc(bytes[0].length, 90));
        return new Response(new Uint8Array(bytes[id - 1]));
      };
      await expect(prepareReleaseProvenance({ repository: 'o/r', releaseId: 123, token: 'test', commitSha: sha,
        tag: `v${ver}`, artifactDir: dir, fetchImpl })).rejects.toThrow('Checksum mismatch');
      expect(downloads).toBe(7);
      expect(mutations).toEqual([]);
      expect(readFileSync(join(dir, names[0])).equals(bytes[0])).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
