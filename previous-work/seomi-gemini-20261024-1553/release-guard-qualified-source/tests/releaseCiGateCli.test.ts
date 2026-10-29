import { describe, expect, it } from 'vitest';
import { runReleaseCiGateCli } from '../scripts/release-ci-gate.mjs';
import { runReleaseGateTagCli } from '../scripts/release-ci-gate-tag.mjs';

const shaA = 'a'.repeat(40);
const shaB = 'b'.repeat(40);

const mockFetch = (handlers: Record<string, { status?: number; data: unknown }>): typeof fetch => {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    const handler = Object.entries(handlers).find(([k]) => url.includes(k));
    if (!handler) return { ok: false, status: 404, json: async () => ({}) } as Response;
    const { status = 200, data } = handler[1];
    return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
  };
};

describe('release CI and Tag CLI execution', () => {
  it('preflight CLI treats branch push for an existing older tag as no-op publish=false', async () => {
    const fetchImpl = mockFetch({
      '/git/ref/tags/': { status: 200, data: { object: { sha: shaB, type: 'commit' } } },
    });
    const result = await runReleaseGateTagCli(
      {
        GITHUB_REF_TYPE: 'branch', GITHUB_REF_NAME: 'main',
        RELEASE_COMMIT_SHA: shaA, GITHUB_REPOSITORY: 'owner/repo', GH_TOKEN: 'secret',
      },
      ['--preflight'],
      fetchImpl,
    );
    expect(result).toMatchObject({ publish: false });
  });

  it('preflight CLI resolves fresh branch push to publish=true when tag is new', async () => {
    const fetchImpl = mockFetch({
      '/git/ref/tags/': { status: 404, data: {} },
    });
    const result = await runReleaseGateTagCli(
      {
        GITHUB_REF_TYPE: 'branch', GITHUB_REF_NAME: 'main',
        RELEASE_COMMIT_SHA: shaA, GITHUB_REPOSITORY: 'owner/repo', GH_TOKEN: 'secret',
      },
      ['--preflight'],
      fetchImpl,
    );
    expect(result).toMatchObject({ publish: true });
  });

  it('preflight CLI verifies matching tag push against remote target SHA', async () => {
    const fetchImpl = mockFetch({
      '/git/ref/tags/': { status: 200, data: { object: { sha: shaA, type: 'commit' } } },
    });
    const result = await runReleaseGateTagCli(
      {
        GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'v0.4.40',
        RELEASE_COMMIT_SHA: shaA, GITHUB_REPOSITORY: 'owner/repo', GH_TOKEN: 'secret',
      },
      ['--preflight'],
      fetchImpl,
    );
    expect(result).toEqual({ tag: 'v0.4.40', publish: true });
  });

  it('preflight CLI rejects mismatched tag name before builders start', async () => {
    await expect(runReleaseGateTagCli(
      {
        GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'v0.9.99',
        RELEASE_COMMIT_SHA: shaA, GITHUB_REPOSITORY: 'owner/repo', GH_TOKEN: 'secret',
      },
      ['--preflight'],
    )).rejects.toThrow('does not match expected version tag');
  });

  it('preflight CLI rejects tag trigger pointing to a different commit', async () => {
    const fetchImpl = mockFetch({
      '/git/ref/tags/v0.4.40': { status: 200, data: { object: { sha: shaB, type: 'commit' } } },
    });
    await expect(runReleaseGateTagCli(
      {
        GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'v0.4.40',
        RELEASE_COMMIT_SHA: shaA, GITHUB_REPOSITORY: 'owner/repo', GH_TOKEN: 'secret',
      },
      ['--preflight'],
      fetchImpl,
    )).rejects.toThrow(`points to ${shaB}, expected ${shaA}`);
  });

  it('verify CLI rejects release tag pointing to wrong target commit', async () => {
    const fetchImpl = mockFetch({
      '/git/ref/tags/v0.4.40': { status: 200, data: { object: { sha: shaB, type: 'commit' } } },
    });
    await expect(runReleaseGateTagCli(
      {
        RELEASE_TAG: 'v0.4.40',
        RELEASE_COMMIT_SHA: shaA, GITHUB_REPOSITORY: 'owner/repo', GH_TOKEN: 'secret',
      },
      ['--verify'],
      fetchImpl,
    )).rejects.toThrow(`points to ${shaB}, expected ${shaA}`);
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
