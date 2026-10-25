import { describe, expect, it } from 'vitest';
import { runReleaseCiGateCli } from '../scripts/release-ci-gate.mjs';
import { runReleaseGateTagCli } from '../scripts/release-ci-gate-tag.mjs';
import { createPackageFixture, mockFetch, shaA, shaB } from './releaseCiGateCliHelpers.js';

describe('release CI and Tag CLI execution', () => {
  it.each(['0.4.40', '0.4.41'])('preflight CLI treats branch push for existing tag as no-op for %s', async (ver) => {
    const fix = createPackageFixture(ver);
    try {
      const fetchImpl = mockFetch({ '/git/ref/tags/': { status: 200, data: { object: { sha: shaB, type: 'commit' } } } });
      const res = await runReleaseGateTagCli(
        { GITHUB_REF_TYPE: 'branch', GITHUB_REF_NAME: 'main', RELEASE_COMMIT_SHA: shaA, GITHUB_REPOSITORY: 'o/r', GH_TOKEN: 'sec' },
        ['--preflight'], fetchImpl, fix.pkgPath,
      );
      expect(res).toMatchObject({ publish: false });
    } finally { fix.cleanup(); }
  });

  it.each(['0.4.40', '0.4.41'])('preflight CLI resolves fresh branch push to publish=true for %s', async (ver) => {
    const fix = createPackageFixture(ver);
    try {
      const fetchImpl = mockFetch({ '/git/ref/tags/': { status: 404, data: {} } });
      const res = await runReleaseGateTagCli(
        { GITHUB_REF_TYPE: 'branch', GITHUB_REF_NAME: 'main', RELEASE_COMMIT_SHA: shaA, GITHUB_REPOSITORY: 'o/r', GH_TOKEN: 'sec' },
        ['--preflight'], fetchImpl, fix.pkgPath,
      );
      expect(res).toMatchObject({ publish: true });
    } finally { fix.cleanup(); }
  });

  it.each(['0.4.40', '0.4.41'])('preflight CLI verifies matching tag push against remote target SHA for %s', async (ver) => {
    const fix = createPackageFixture(ver);
    try {
      const tag = `v${ver}`;
      const fetchImpl = mockFetch({ [`/git/ref/tags/${tag}`]: { status: 200, data: { object: { sha: shaA, type: 'commit' } } } });
      const res = await runReleaseGateTagCli(
        { GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: tag, RELEASE_COMMIT_SHA: shaA, GITHUB_REPOSITORY: 'o/r', GH_TOKEN: 'sec' },
        ['--preflight'], fetchImpl, fix.pkgPath,
      );
      expect(res).toEqual({ tag, publish: true });
    } finally { fix.cleanup(); }
  });

  it('preflight CLI rejects mismatched tag name before builders start', async () => {
    const fix = createPackageFixture('0.4.41');
    try {
      await expect(runReleaseGateTagCli(
        { GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'v0.9.99', RELEASE_COMMIT_SHA: shaA, GITHUB_REPOSITORY: 'o/r', GH_TOKEN: 'sec' },
        ['--preflight'], mockFetch({}), fix.pkgPath,
      )).rejects.toThrow('does not match expected version tag');
    } finally { fix.cleanup(); }
  });

  it.each(['0.4.40', '0.4.41'])('preflight CLI rejects tag trigger pointing to a different commit for %s', async (ver) => {
    const fix = createPackageFixture(ver);
    try {
      const tag = `v${ver}`;
      const fetchImpl = mockFetch({ [`/git/ref/tags/${tag}`]: { status: 200, data: { object: { sha: shaB, type: 'commit' } } } });
      await expect(runReleaseGateTagCli(
        { GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: tag, RELEASE_COMMIT_SHA: shaA, GITHUB_REPOSITORY: 'o/r', GH_TOKEN: 'sec' },
        ['--preflight'], fetchImpl, fix.pkgPath,
      )).rejects.toThrow(`points to ${shaB}, expected ${shaA}`);
    } finally { fix.cleanup(); }
  });

  it.each(['0.4.40', '0.4.41'])('verify CLI rejects release tag pointing to wrong target commit for %s', async (ver) => {
    const fix = createPackageFixture(ver);
    try {
      const tag = `v${ver}`;
      const fetchImpl = mockFetch({ [`/git/ref/tags/${tag}`]: { status: 200, data: { object: { sha: shaB, type: 'commit' } } } });
      await expect(runReleaseGateTagCli(
        { RELEASE_TAG: tag, RELEASE_COMMIT_SHA: shaA, GITHUB_REPOSITORY: 'o/r', GH_TOKEN: 'sec' },
        ['--verify'], fetchImpl, fix.pkgPath,
      )).rejects.toThrow(`points to ${shaB}, expected ${shaA}`);
    } finally { fix.cleanup(); }
  });

  it('runs release CI gate CLI and logs success message on all checks', async () => {
    const runs = [
      { name: 'Rust Backend Unit & Security Tests', id: 1, conclusion: 'success', status: 'completed', head_sha: shaA, app: { id: 15368 } },
      { name: 'Frontend TypeScript, i18n & Vitest', id: 2, conclusion: 'success', status: 'completed', head_sha: shaA, app: { id: 15368 } },
      { name: 'Desktop platform smoke (windows-latest)', id: 3, conclusion: 'success', status: 'completed', head_sha: shaA, app: { id: 15368 } },
      { name: 'Dependency Vulnerability Scan & SBOM', id: 4, conclusion: 'success', status: 'completed', head_sha: shaA, app: { id: 15368 } },
      { name: 'Desktop platform smoke (macos-15-intel)', id: 5, conclusion: 'success', status: 'completed', head_sha: shaA, app: { id: 15368 } },
      { name: 'Rust production coverage measurement', id: 6, conclusion: 'success', status: 'completed', head_sha: shaA, app: { id: 15368 } },
      { name: 'Frontend and MCP coverage (98% follow-up)', id: 7, conclusion: 'success', status: 'completed', head_sha: shaA, app: { id: 15368 } },
      { name: 'Rust production coverage (95% follow-up)', id: 8, conclusion: 'success', status: 'completed', head_sha: shaA, app: { id: 15368 } },
      { name: 'Analyze (javascript-typescript)', id: 9, conclusion: 'success', status: 'completed', head_sha: shaA, app: { id: 15368 } },
      { name: 'Analyze (actions)', id: 10, conclusion: 'success', status: 'completed', head_sha: shaA, app: { id: 15368 } },
      { name: 'CodeQL', id: 11, conclusion: 'success', status: 'completed', head_sha: shaA, app: { id: 57789 } },
    ];
    const fetchImpl: typeof fetch = async () => ({
      ok: true, status: 200, json: async () => ({ total_count: runs.length, check_runs: runs }),
    }) as Response;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    try {
      const summary = await runReleaseCiGateCli({
        RELEASE_COMMIT_SHA: shaA, GITHUB_REPOSITORY: 'owner/repo', GITHUB_TOKEN: 'secret',
      });
      expect(summary.status).toBe('success');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
