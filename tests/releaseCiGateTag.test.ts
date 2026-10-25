import { describe, expect, it } from 'vitest';
import {
  checkTagExistsRemote,
  resolveExpectedTag,
  resolveReleaseTag,
  validateReleaseGateTag,
  verifyTagTargetCommit,
} from '../scripts/release-ci-gate-tag.mjs';

const shaA = 'a'.repeat(40);
const shaB = 'b'.repeat(40);
const tagSha = 'c'.repeat(40);

const mockFetch = (handlers: Record<string, { status?: number; data: unknown }>): typeof fetch => {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    const handler = Object.entries(handlers).find(([k]) => url.includes(k));
    if (!handler) return { ok: false, status: 404, json: async () => ({}) } as Response;
    const { status = 200, data } = handler[1];
    return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
  };
};

describe('release tag and target validator', () => {
  it('resolves expected tag from package.json and matches version', () => {
    const tag = resolveExpectedTag('./package.json');
    expect(tag).toMatch(/^v\d+\.\d+\.\d+$/);
    const resolved = resolveReleaseTag({ refType: 'tag', refName: tag, packageVersion: tag.slice(1) });
    expect(resolved).toEqual({ tag, publish: true });
  });

  it('rejects mismatched tag trigger in preflight', () => {
    expect(() => resolveReleaseTag({
      refType: 'tag', refName: 'v0.9.99', packageVersion: '0.4.40',
    })).toThrow('does not match expected version tag v0.4.40');
  });

  it('resolves branch push and checks if tag already exists in remote', async () => {
    const fresh = resolveReleaseTag({ refType: 'branch', refName: 'main', packageVersion: '0.4.40', tagExistsRemote: false });
    expect(fresh).toEqual({ tag: 'v0.4.40', publish: true });
    const existing = resolveReleaseTag({ refType: 'branch', refName: 'main', packageVersion: '0.4.40', tagExistsRemote: true });
    expect(existing).toEqual({ tag: 'v0.4.40', publish: false });

    const fetchExists = mockFetch({ '/git/ref/tags/v0.4.40': { status: 200, data: {} } });
    expect(await checkTagExistsRemote({ repository: 'owner/repo', tag: 'v0.4.40', token: 'sec', fetchImpl: fetchExists })).toBe(true);
    const fetchMissing = mockFetch({});
    expect(await checkTagExistsRemote({ repository: 'owner/repo', tag: 'v0.4.40', token: 'sec', fetchImpl: fetchMissing })).toBe(false);
  });

  it('verifies lightweight tag pointing directly to target commit', async () => {
    const fetchImpl = mockFetch({
      '/git/ref/tags/v0.4.40': { data: { object: { type: 'commit', sha: shaA } } },
    });
    const result = await verifyTagTargetCommit({
      repository: 'owner/repo', tag: 'v0.4.40', expectedSha: shaA, token: 'secret', fetchImpl,
    });
    expect(result).toEqual({ tag: 'v0.4.40', commitSha: shaA, objectType: 'commit' });
  });

  it('rejects tag pointing to a different commit target', async () => {
    const fetchImpl = mockFetch({
      '/git/ref/tags/v0.4.40': { data: { object: { type: 'commit', sha: shaB } } },
    });
    await expect(verifyTagTargetCommit({
      repository: 'owner/repo', tag: 'v0.4.40', expectedSha: shaA, token: 'secret', fetchImpl,
    })).rejects.toThrow(`points to ${shaB}, expected ${shaA}`);
  });

  it('peels annotated tag object to verify underlying commit SHA', async () => {
    const fetchImpl = mockFetch({
      '/git/ref/tags/v0.4.40': { data: { object: { type: 'tag', sha: tagSha } } },
      [`/git/tags/${tagSha}`]: { data: { object: { sha: shaA, type: 'commit' } } },
    });
    const result = await verifyTagTargetCommit({
      repository: 'owner/repo', tag: 'v0.4.40', expectedSha: shaA, token: 'secret', fetchImpl,
    });
    expect(result).toEqual({ tag: 'v0.4.40', commitSha: shaA, objectType: 'tag' });
  });

  it('rejects annotated tag when peeled commit does not match target', async () => {
    const fetchImpl = mockFetch({
      '/git/ref/tags/v0.4.40': { data: { object: { type: 'tag', sha: tagSha } } },
      [`/git/tags/${tagSha}`]: { data: { object: { sha: shaB, type: 'commit' } } },
    });
    await expect(verifyTagTargetCommit({
      repository: 'owner/repo', tag: 'v0.4.40', expectedSha: shaA, token: 'secret', fetchImpl,
    })).rejects.toThrow(`points to ${shaB}, expected ${shaA}`);
  });

  it('detects shifted or missing ref when tag is not found', async () => {
    const fetchImpl = mockFetch({});
    await expect(verifyTagTargetCommit({
      repository: 'owner/repo', tag: 'v0.4.40', expectedSha: shaA, token: 'secret', fetchImpl,
    })).rejects.toThrow('Release tag v0.4.40 not found');
  });

  it('validates combined release gate in preflight for tag trigger', async () => {
    const fetchImpl = mockFetch({
      '/git/ref/tags/v0.4.40': { data: { object: { type: 'commit', sha: shaA } } },
    });
    const result = await validateReleaseGateTag({
      refType: 'tag', refName: 'v0.4.40', packageVersion: '0.4.40',
      expectedSha: shaA, repository: 'owner/repo', token: 'secret', fetchImpl,
    });
    expect(result).toEqual({ tag: 'v0.4.40', publish: true });
  });
});
