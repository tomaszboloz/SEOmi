import { describe, expect, it } from 'vitest';
import { listAllReleases, parseNextLinkHeader, isTrustedNextUrl } from '../scripts/release-ci-gate-inventory.mjs';
import { createOrGetDraftRelease, verifyAndPublishDraftRelease } from '../scripts/release-ci-gate-publish.mjs';

const resp = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });

const repo = 'owner/repo';
const sha = 'a'.repeat(40);
const fullAssets = [
  { id: 1, name: 'SEOmi_0.4.40_aarch64.dmg', size: 100 },
  { id: 2, name: 'SEOmi_aarch64.app.tar.gz', size: 100 },
  { id: 3, name: 'SEOmi_aarch64.app.tar.gz.sig', size: 50 },
  { id: 4, name: 'SEOmi_0.4.40_x64.dmg', size: 100 },
  { id: 5, name: 'SEOmi_x64.app.tar.gz', size: 100 },
  { id: 6, name: 'SEOmi_x64.app.tar.gz.sig', size: 50 },
  { id: 7, name: 'SEOmi_0.4.40_x64-setup.exe', size: 100 },
  { id: 8, name: 'SEOmi_0.4.40_x64-setup.exe.sig', size: 50 },
  { id: 9, name: 'SEOmi_0.4.40_x64_en-US.msi', size: 100 },
  { id: 10, name: 'SEOmi_0.4.40_x64_en-US.msi.sig', size: 50 },
  { id: 11, name: 'latest.json', size: 100 },
];
const latestJson = {
  version: '0.4.40',
  platforms: {
    'darwin-aarch64': { url: `https://github.com/${repo}/releases/download/v0.4.40/SEOmi_aarch64.app.tar.gz`, signature: 's1' },
    'darwin-x86_64': { url: `https://github.com/${repo}/releases/download/v0.4.40/SEOmi_x64.app.tar.gz`, signature: 's2' },
    'windows-x86_64': { url: `https://github.com/${repo}/releases/download/v0.4.40/SEOmi_0.4.40_x64-setup.exe`, signature: 's3' },
  },
};

describe('release-ci-gate-inventory pagination and schema validation', () => {
  it('parses next link header and validates trusted next URLs', () => {
    expect(parseNextLinkHeader('<https://api.github.com/page2>; rel="next"')).toBe('https://api.github.com/page2');
    expect(parseNextLinkHeader('<https://api.github.com/page2>; rel=next, <https://api.github.com/p3>; rel="last"')).toBe('https://api.github.com/page2');
    expect(parseNextLinkHeader(null)).toBeNull();
    const base = new URL('https://api.github.com/repos/o/r/releases');
    expect(isTrustedNextUrl(new URL('https://api.github.com/repos/o/r/releases?page=2'), base)).toBe(true);
    expect(isTrustedNextUrl(new URL('http://api.github.com/repos/o/r/releases?page=2'), base)).toBe(false);
    expect(isTrustedNextUrl(new URL('https://evil.com/repos/o/r/releases?page=2'), base)).toBe(false);
    expect(isTrustedNextUrl(new URL('https://api.github.com/repos/other/releases?page=2'), base)).toBe(false);
  });

  it('rejects publication when conflicting draft is found on page 2', async () => {
    let patched = false;
    const fetchImpl = async (url: string | URL | Request, opts?: RequestInit) => {
      const u = String(url);
      if (opts?.method === 'PATCH') { patched = true; return resp({ id: 123, draft: false }); }
      if (u.includes('/releases/123')) return resp({ id: 123, tag_name: 'v0.4.40', draft: true, target_commitish: sha, assets: fullAssets });
      if (u.includes('/git/ref/tags/v0.4.40')) return resp({ object: { type: 'commit', sha } });
      if (u.includes('/releases?') && !u.includes('page=2')) {
        return resp([{ id: 123, tag_name: 'v0.4.40', draft: true }], 200, { Link: '<https://api.github.com/repos/owner/repo/releases?per_page=50&page=2>; rel="next"' });
      }
      if (u.includes('page=2')) return resp([{ id: 999, tag_name: 'v0.4.40', draft: true }]);
      return resp({}, 404);
    };
    await expect(verifyAndPublishDraftRelease({ repository: repo, releaseId: 123, expectedSha: sha, candidateVersion: '0.4.40', token: 'tok', fetchImpl }))
      .rejects.toThrow('Conflicting duplicate draft release(s) exist for tag v0.4.40: [999]');
    expect(patched).toBe(false);
  });

  it('fails closed when inventory schema is invalid for both flows without mutating', async () => {
    let created = false;
    let published = false;
    const invalidFetch = async (_url: string | URL | Request, opts?: RequestInit) => {
      if (opts?.method === 'POST') { created = true; return resp({ id: 123 }, 201); }
      if (opts?.method === 'PATCH') { published = true; return resp({ id: 123 }, 200); }
      if (String(_url).includes('/releases/123')) return resp({ id: 123, tag_name: 'v0.4.40', draft: true, target_commitish: sha, assets: fullAssets });
      if (String(_url).includes('/git/ref/')) return resp({ object: { type: 'commit', sha } });
      return resp({ message: 'not an array' }, 200);
    };
    await expect(createOrGetDraftRelease({ repository: repo, tag: 'v0.4.40', commitSha: sha, candidateVersion: '0.4.40', token: 'tok', fetchImpl: invalidFetch }))
      .rejects.toThrow('expected Array, got object');
    expect(created).toBe(false);
    await expect(verifyAndPublishDraftRelease({ repository: repo, releaseId: 123, expectedSha: sha, candidateVersion: '0.4.40', token: 'tok', fetchImpl: invalidFetch }))
      .rejects.toThrow('expected Array, got object');
    expect(published).toBe(false);
  });

  it('fails closed on page 2 HTTP 503', async () => {
    const fetchImpl = async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('page=2')) return resp({ message: 'service unavailable' }, 503);
      return resp([], 200, { Link: '<https://api.github.com/repos/owner/repo/releases?per_page=50&page=2>; rel="next"' });
    };
    await expect(listAllReleases({ repository: repo, token: 'tok', fetchImpl }))
      .rejects.toThrow('Failed to list releases from https://api.github.com/repos/owner/repo/releases?per_page=50&page=2: HTTP 503');
  });

  it('aborts on cyclic next URLs and never leaks token to untrusted origins', async () => {
    const cyclicFetch = async (url: string | URL | Request) => {
      const u = String(url);
      const next = u.includes('page=2') ? 'https://api.github.com/repos/owner/repo/releases?per_page=50' : 'https://api.github.com/repos/owner/repo/releases?per_page=50&page=2';
      return resp([], 200, { Link: `<${next}>; rel="next"` });
    };
    await expect(listAllReleases({ repository: repo, token: 'tok', fetchImpl: cyclicFetch }))
      .rejects.toThrow('Cyclic pagination detected');

    const leakedCalls: string[] = [];
    const untrustedFetch = async (url: string | URL | Request, opts?: RequestInit) => {
      const u = String(url);
      const parsed = new URL(u);
      leakedCalls.push(u);
      if (opts?.headers && 'Authorization' in opts.headers && parsed.hostname === 'evil.com') {
        throw new Error('TOKEN LEAKED TO EVIL HOST');
      }
      return resp([], 200, { Link: '<https://evil.com/repos/owner/repo/releases?page=2>; rel="next"' });
    };
    await expect(listAllReleases({ repository: repo, token: 'secret-token', fetchImpl: untrustedFetch }))
      .rejects.toThrow('Untrusted pagination next URL: https://evil.com/repos/owner/repo/releases?page=2');
    expect(leakedCalls.some((c) => new URL(c).hostname === 'evil.com')).toBe(false);
  });

  it('successfully paginates multi-page release inventory without conflict', async () => {
    let patched = false;
    const fetchImpl = async (url: string | URL | Request, opts?: RequestInit) => {
      const u = String(url);
      if (opts?.method === 'PATCH') { patched = true; return resp({ id: 123, draft: false }); }
      if (u.includes('/releases/123')) return resp({ id: 123, tag_name: 'v0.4.40', draft: true, target_commitish: sha, assets: fullAssets });
      if (u.includes('/git/ref/tags/v0.4.40')) return resp({ object: { type: 'commit', sha } });
      if (u.includes('/releases?') && !u.includes('page=2')) {
        return resp(Array.from({ length: 50 }, (_, i) => ({ id: 500 + i, tag_name: `v0.0.${i}`, draft: false })), 200,
          { Link: '<https://api.github.com/repos/owner/repo/releases?per_page=50&page=2>; rel="next"' });
      }
      if (u.includes('page=2')) return resp([{ id: 123, tag_name: 'v0.4.40', draft: true }]);
      if (u.endsWith('/assets/11')) return resp(latestJson);
      if (u.endsWith('/assets/3')) return resp('s1');
      if (u.endsWith('/assets/6')) return resp('s2');
      if (u.endsWith('/assets/8')) return resp('s3');
      return resp({}, 404);
    };
    const res = await verifyAndPublishDraftRelease({ repository: repo, releaseId: 123, expectedSha: sha, candidateVersion: '0.4.40', token: 'tok', fetchImpl });
    expect(patched).toBe(true);
    expect(res).toEqual({ id: 123, draft: false });
  });
});
