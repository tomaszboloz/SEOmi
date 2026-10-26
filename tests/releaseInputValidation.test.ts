import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  validateGithubApiBase, validateReleaseId, validateReleaseTag, validateReleaseVersion, validateRepository, writeGithubOutput,
} from '../scripts/release-input-validation.mjs';
import { runReleaseGateTagCli, checkTagExistsRemote } from '../scripts/release-ci-gate-tag.mjs';
import { uploadReleaseAsset } from '../scripts/release-ci-gate-provenance-upload.mjs';

describe('release trust boundaries', () => {
  it.each(['0.4.41\n', '0.4.41/secret', 'v0.4.41', '01.4.41', '0.4', '0.4.41-beta', '0.4.9007199254740992', null])(
    'rejects malformed stable version %j', (value) => { expect(() => validateReleaseVersion(value)).toThrow(); },
  );
  it('preserves canonical public release inputs', () => {
    expect(validateReleaseVersion('0.4.41')).toBe('0.4.41');
    expect(validateReleaseTag('v0.4.41')).toBe('v0.4.41');
    expect(validateRepository('tomaszboloz/SEOmi')).toBe('tomaszboloz/SEOmi');
    expect(validateReleaseId('123')).toBe(123);
    expect(validateGithubApiBase('https://api.github.com')).toBe('https://api.github.com');
    expect(validateGithubApiBase('https://uploads.github.com', true)).toBe('https://uploads.github.com');
  });
  it.each(['123\npublish=true', '00123', '123\n', '-1', 0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1, {}])(
    'rejects non-scalar or unbounded release ID %j', (value) => { expect(() => validateReleaseId(value)).toThrow(); },
  );
  it.each(['owner/repo\n', 'owner/..', '../repo', 'owner/repo/extra', 'owner/repo?secret=1', 'owner/repo#x'])('rejects unsafe repository %s', (value) => {
    expect(() => validateRepository(value)).toThrow();
  });
  it('blocks wrong-origin requests before releasing any credentials or content', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(checkTagExistsRemote({ apiUrl: 'https://api.github.com.evil.test', repository: 'owner/repo', tag: 'v0.4.41', token: 'secret', fetchImpl })).rejects.toThrow('origin');
    await expect(uploadReleaseAsset({ uploadUrl: 'https://evil.test', repository: 'owner/repo', releaseId: 123, token: 'secret', name: 'sbom-node.json', content: '{}', fetchImpl })).rejects.toThrow('origin');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('writes only approved single-line workflow output values', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seomi-output-'));
    try {
      const output = join(dir, 'outputs'); writeFileSync(output, '');
      writeGithubOutput('tag', 'v0.4.41', output);
      writeGithubOutput('publish', 'true', output);
      writeGithubOutput('release_id', 123, output);
      const before = readFileSync(output, 'utf8');
      expect(before).toBe('tag=v0.4.41\npublish=true\nrelease_id=123\n');
      expect(() => writeGithubOutput('release_id', '123\nnew=value', output)).toThrow();
      expect(() => writeGithubOutput('tag', 'v0.4.41\nnew=value', output)).toThrow();
      expect(() => writeGithubOutput('unknown', 'x', output)).toThrow();
      expect(readFileSync(output, 'utf8')).toBe(before);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('rejects a malicious version read from a real package fixture before network calls', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'seomi-version-boundary-'));
    try {
      const path = join(dir, 'package.json'); writeFileSync(path, JSON.stringify({ version: '0.4.41\nsecret=value' }));
      const fetchImpl = vi.fn<typeof fetch>();
      await expect(runReleaseGateTagCli({ GITHUB_REPOSITORY: 'owner/repo', GITHUB_TOKEN: 'secret' }, ['--preflight'], fetchImpl, path)).rejects.toThrow('version');
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
