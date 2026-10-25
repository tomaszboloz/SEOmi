import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  computeRemoteAssetName,
  consolidateManifests,
  extractPlatformFragment,
  findFiles,
} from '../scripts/release-ci-gate-manifest.mjs';

describe('release updater manifest extractor and consolidator with real Tauri layout', () => {
  it('maps un-architected local macOS bundles to remote architecture-qualified asset names', () => {
    expect(computeRemoteAssetName('/path/to/SEOmi.app.tar.gz', 'darwin-aarch64')).toBe('SEOmi_aarch64.app.tar.gz');
    expect(computeRemoteAssetName('/path/to/SEOmi.app.tar.gz', 'darwin-x86_64')).toBe('SEOmi_x64.app.tar.gz');
    expect(computeRemoteAssetName('/path/to/SEOmi_0.4.40_x64-setup.exe', 'windows-x86_64')).toBe('SEOmi_0.4.40_x64-setup.exe');
  });

  it('extracts platform fragment from target/arch/bundle/macos/SEOmi.app.tar.gz + sig', () => {
    const root = mkdtempSync(join(tmpdir(), 'seomi-manifest-target-'));
    const testDir = join(root, 'target');
    try {
      const armDir = `${testDir}/aarch64-apple-darwin/release/bundle/macos`;
      mkdirSync(armDir, { recursive: true });
      writeFileSync(`${armDir}/SEOmi.app.tar.gz`, 'arm-bundle-content');
      writeFileSync(`${armDir}/SEOmi.app.tar.gz.sig`, 'test-signature-aarch64');

      const fragment = extractPlatformFragment({
        platform: 'macos-15',
        targetDir: testDir,
        repository: 'owner/repo',
        tag: 'v0.4.40',
      });
      expect(fragment.platform).toBe('darwin-aarch64');
      expect(fragment.entry.signature).toBe('test-signature-aarch64');
      expect(fragment.entry.url).toBe('https://github.com/owner/repo/releases/download/v0.4.40/SEOmi_aarch64.app.tar.gz');
      expect(existsSync('updater-manifest-macos-15.json')).toBe(true);
    } finally {
      rmSync('updater-manifest-macos-15.json', { force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects conflicting duplicate fragments and inventory HTTP 503', async () => {
    const root = mkdtempSync(join(tmpdir(), 'seomi-manifest-conflicts-'));
    const dir = join(root, 'fragments');
    try {
      mkdirSync(dir);
      writeFileSync(`${dir}/1.json`, JSON.stringify({ platform: 'darwin-aarch64', entry: { signature: 's1', url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_aarch64.app.tar.gz' } }));
      writeFileSync(`${dir}/2.json`, JSON.stringify({ platform: 'darwin-aarch64', entry: { signature: 's2', url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_aarch64.app.tar.gz' } }));
      await expect(consolidateManifests({ manifestDir: dir, candidateVersion: '0.4.40' }))
        .rejects.toThrow('Conflicting duplicate platform fragment for darwin-aarch64');

      const fetch503 = async () => ({ ok: false, status: 503 } as Response);
      rmSync(`${dir}/2.json`);
      writeFileSync(`${dir}/mac-intel.json`, JSON.stringify({ platform: 'darwin-x86_64', entry: { signature: 's2', url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_x64.app.tar.gz' } }));
      writeFileSync(`${dir}/win.json`, JSON.stringify({ platform: 'windows-x86_64', entry: { signature: 's3', url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_0.4.40_x64-setup.exe' } }));
      await expect(consolidateManifests({ manifestDir: dir, candidateVersion: '0.4.40', repository: 'o/r', releaseId: 1, token: 't', fetchImpl: fetch503 }))
        .rejects.toThrow('Failed to fetch release 1 during consolidation: HTTP 503');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('throws on missing directory without swallowing errors', () => {
    expect(() => findFiles('/tmp/nonexistent-directory-for-findfiles-98765')).toThrow();
  });

  it('consolidates 3 platform fragments into latest.json and uploads to release', async () => {
    const root = mkdtempSync(join(tmpdir(), 'seomi-manifest-real-'));
    const dir = join(root, 'fragments');
    try {
      mkdirSync(dir);
      writeFileSync(`${dir}/mac-arm.json`, JSON.stringify({ platform: 'darwin-aarch64', entry: { signature: 's1', url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_aarch64.app.tar.gz' } }));
      writeFileSync(`${dir}/mac-intel.json`, JSON.stringify({ platform: 'darwin-x86_64', entry: { signature: 's2', url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_x64.app.tar.gz' } }));
      writeFileSync(`${dir}/win.json`, JSON.stringify({ platform: 'windows-x86_64', entry: { signature: 's3', url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_0.4.40_x64-setup.exe' } }));

      let deletedAsset = false;
      let uploadedAsset = false;
      const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (method === 'DELETE') { deletedAsset = true; return { ok: true, status: 204 } as Response; }
        if (url.includes('/assets?name=latest.json')) { uploadedAsset = true; return { ok: true, status: 201 } as Response; }
        if (url.includes('/releases/123')) return { ok: true, status: 200, json: async () => ({ id: 123, assets: [{ id: 99, name: 'latest.json' }] }) } as Response;
        return { ok: false, status: 404 } as Response;
      };

      const res = await consolidateManifests({ manifestDir: dir, candidateVersion: '0.4.40', repository: 'o/r', releaseId: 123, token: 'tok', fetchImpl });
      expect(res.version).toBe('0.4.40');
      expect(Object.keys(res.platforms as object)).toEqual(['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64']);
      expect(deletedAsset).toBe(true);
      expect(uploadedAsset).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync('latest.json', { force: true });
    }
  });
});
