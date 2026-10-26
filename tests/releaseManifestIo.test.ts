import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { consolidateManifests, extractPlatformFragment } from '../scripts/release-ci-gate-manifest.mjs';

const writeFragments = (dir: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/arm.json`, JSON.stringify({ platform: 'darwin-aarch64', entry: { signature: 's1', url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_aarch64.app.tar.gz' } }));
  writeFileSync(`${dir}/intel.json`, JSON.stringify({ platform: 'darwin-x86_64', entry: { signature: 's2', url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_x64.app.tar.gz' } }));
  writeFileSync(`${dir}/windows.json`, JSON.stringify({ platform: 'windows-x86_64', entry: { signature: 's3', url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_0.4.40_x64-setup.exe' } }));
};

describe('release manifest IO boundaries', () => {
  it('prefers exact signed Windows EXE and falls back to exact MSI', () => {
    const root = mkdtempSync(join(tmpdir(), 'seomi-manifest-windows-')), targetDir = join(root, 'target', 'x');
    const exe = join(targetDir, 'SEOmi_0.4.40_x64-setup.exe'), msi = join(targetDir, 'SEOmi_0.4.40_x64_en-US.msi');
    const cwd = process.cwd(); process.chdir(root);
    try {
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(msi, 'msi'); writeFileSync(`${msi}.sig`, 'msi-signature');
      writeFileSync(exe, 'exe'); writeFileSync(`${exe}.sig`, 'exe-signature');
      let fragment = extractPlatformFragment({ platform: 'windows-latest', targetDir, repository: 'owner/repo', tag: 'v0.4.40' });
      expect(fragment.entry.signature).toBe('exe-signature');
      rmSync(exe); rmSync(`${exe}.sig`);
      fragment = extractPlatformFragment({ platform: 'windows-latest', targetDir, repository: 'owner/repo', tag: 'v0.4.40' });
      expect(fragment.entry.url).toContain('SEOmi_0.4.40_x64_en-US.msi');
    } finally { process.chdir(cwd); rmSync(root, { recursive: true, force: true }); }
  });

  it('maps an unversioned signed local macOS bundle to the versioned remote asset', () => {
    const root = mkdtempSync(join(tmpdir(), 'seomi-manifest-versioned-mac-')), targetDir = join(root, 'target', 'aarch64-apple-darwin');
    const cwd = process.cwd(); process.chdir(root);
    try {
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(join(targetDir, 'SEOmi.app.tar.gz'), 'bundle');
      writeFileSync(join(targetDir, 'SEOmi.app.tar.gz.sig'), 'arm-signature');
      const fragment = extractPlatformFragment({ platform: 'macos-15', targetDir: join(root, 'target'), repository: 'owner/repo', tag: 'v0.4.42' });
      expect(fragment.entry.url).toContain('SEOmi_0.4.42_aarch64.app.tar.gz');
    } finally { process.chdir(cwd); rmSync(root, { recursive: true, force: true }); }
  });

  it('rejects signature symlinks outside target before writing output', () => {
    const root = mkdtempSync(join(tmpdir(), 'seomi-manifest-sig-link-')), targetDir = join(root, 'target');
    const bundle = join(targetDir, 'aarch64-apple-darwin', 'SEOmi.app.tar.gz'), output = 'updater-manifest-macos-15.json';
    const cwd = process.cwd(); process.chdir(root);
    try {
      mkdirSync(join(targetDir, 'aarch64-apple-darwin'), { recursive: true }); writeFileSync(bundle, 'bundle');
      const outside = join(root, 'private.sig'); writeFileSync(outside, 'private-signature'); symlinkSync(outside, `${bundle}.sig`);
      writeFileSync(output, 'sentinel');
      expect(() => extractPlatformFragment({ platform: 'macos-15', targetDir, repository: 'owner/repo', tag: 'v0.4.40' })).toThrow('path escape');
      expect(readFileSync(output, 'utf8')).toBe('sentinel');
    } finally { process.chdir(cwd); rmSync(root, { recursive: true, force: true }); }
  });

  it.each([
    ['invalid signature', { signature: 's1\n', url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_aarch64.app.tar.gz' }],
    ['invalid URL', { signature: 's1', url: 'https://evil.example/o/r/releases/download/v0.4.40/SEOmi_aarch64.app.tar.gz' }],
  ])('does not write or upload on %s', async (_label, entry) => {
    const root = mkdtempSync(join(tmpdir(), 'seomi-manifest-invalid-')), dir = join(root, 'fragments');
    const cwd = process.cwd(); process.chdir(root);
    let requests = 0;
    try {
      mkdirSync(dir); writeFileSync(`${dir}/bad.json`, JSON.stringify({ platform: 'darwin-aarch64', entry }));
      writeFileSync('latest.json', 'sentinel');
      await expect(consolidateManifests({ manifestDir: dir, candidateVersion: '0.4.40', repository: 'o/r', releaseId: 1, token: 't', fetchImpl: async () => { requests += 1; return { ok: true, status: 200 } as Response; } })).rejects.toThrow();
      expect(readFileSync('latest.json', 'utf8')).toBe('sentinel'); expect(requests).toBe(0);
    } finally { process.chdir(cwd); rmSync(root, { recursive: true, force: true }); }
  });

  it('replaces latest.json symlink without touching its target', async () => {
    const root = mkdtempSync(join(tmpdir(), 'seomi-manifest-latest-link-')), dir = join(root, 'fragments');
    const cwd = process.cwd(); process.chdir(root);
    try {
      writeFragments(dir); const outside = join(root, 'outside-latest.json'); writeFileSync(outside, 'keep-me');
      rmSync('latest.json', { force: true }); symlinkSync(outside, 'latest.json');
      await consolidateManifests({ manifestDir: dir, candidateVersion: '0.4.40', repository: 'o/r' });
      expect(readFileSync(outside, 'utf8')).toBe('keep-me'); expect(lstatSync('latest.json').isSymbolicLink()).toBe(false);
    } finally { process.chdir(cwd); rmSync(root, { recursive: true, force: true }); }
  });

  it('rejects an invalid existing release asset id before DELETE', async () => {
    const root = mkdtempSync(join(tmpdir(), 'seomi-manifest-asset-id-')), dir = join(root, 'fragments');
    const cwd = process.cwd(); process.chdir(root);
    let deletes = 0;
    try {
      writeFragments(dir);
      const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'DELETE') deletes += 1;
        if (String(input).includes('/releases/123')) return { ok: true, status: 200, json: async () => ({ assets: [{ id: 'not-an-id', name: 'latest.json' }] }) } as Response;
        return { ok: true, status: 201 } as Response;
      };
      await expect(consolidateManifests({ manifestDir: dir, candidateVersion: '0.4.40', repository: 'o/r', releaseId: 123, token: 'tok', fetchImpl })).rejects.toThrow('Invalid release ID');
      expect(deletes).toBe(0);
    } finally { process.chdir(cwd); rmSync(root, { recursive: true, force: true }); }
  });
});
