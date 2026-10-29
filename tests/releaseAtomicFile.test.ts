import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { itWithFileSymlinks } from './fixtures/fileSymlinks';
import { readReleaseFile, writeReleaseFileAtomically } from '../scripts/release-atomic-file.mjs';
import { fetchOrVerifyAsset } from '../scripts/release-ci-gate-provenance-upload.mjs';

describe('atomic release files', () => {
  itWithFileSymlinks('reads a bounded regular file and refuses outside symlinks and directories', () => {
    const root = mkdtempSync(join(tmpdir(), 'seomi-read-boundary-'));
    try {
      const dir = join(root, 'artifacts'); mkdirSync(dir);
      const source = join(dir, 'sbom-node.json'), outside = join(root, 'private.json');
      writeFileSync(source, '{}'); writeFileSync(outside, 'private');
      expect(readReleaseFile(source, dir).toString('utf8')).toBe('{}');
      symlinkSync(outside, join(dir, 'escape.json'), 'file');
      expect(() => readReleaseFile(join(dir, 'escape.json'), dir)).toThrow('path escape');
      expect(() => readReleaseFile(dir, dir)).toThrow();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('creates and replaces complete bytes while cleaning private staging files', () => {
    const root = mkdtempSync(join(tmpdir(), 'seomi-atomic-'));
    try {
      const path = join(root, 'artifact.json');
      writeReleaseFileAtomically(path, 'first');
      expect(readFileSync(path, 'utf8')).toBe('first');
      writeReleaseFileAtomically(path, Buffer.from('second'));
      expect(readFileSync(path, 'utf8')).toBe('second');
      expect(readdirSync(root)).toEqual(['artifact.json']);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('cleans staging after a failed rename without mutating the destination directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'seomi-atomic-error-'));
    try {
      const path = join(root, 'artifact.json'); mkdirSync(path);
      expect(() => writeReleaseFileAtomically(path, 'bytes')).toThrow();
      expect(lstatSync(path).isDirectory()).toBe(true);
      expect(readdirSync(root)).toEqual(['artifact.json']);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  itWithFileSymlinks('cannot follow a cache symlink swapped during the network download', async () => {
    const root = mkdtempSync(join(tmpdir(), 'seomi-download-race-'));
    try {
      const dir = join(root, 'artifacts'); mkdirSync(dir);
      const destination = join(dir, 'app.exe'), outside = join(root, 'outside.txt');
      writeFileSync(destination, 'old'); writeFileSync(outside, 'preserved');
      await fetchOrVerifyAsset({
        asset: { id: 12, name: 'app.exe', size: 3 }, name: 'app.exe', artifactDir: dir,
        realDir: realpathSync(dir), headers: {}, apiUrl: 'https://api.github.com', repository: 'owner/repo',
        fetchImpl: async () => {
          rmSync(destination); symlinkSync(outside, destination, 'file');
          return new Response('new');
        },
      });
      const downloaded = readReleaseFile(destination, dir);
      expect(readFileSync(outside, 'utf8')).toBe('preserved');
      expect(lstatSync(destination).isSymbolicLink()).toBe(false);
      expect(downloaded.toString('utf8')).toBe('new');
      expect(readdirSync(dir)).toEqual(['app.exe']);
      expect(createHash('sha256').update(downloaded).digest('hex')).toBe(createHash('sha256').update('new').digest('hex'));
      expect(existsSync(outside)).toBe(true);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
