import { describe, expect, it } from 'vitest';
import { verifyAndPublishDraftRelease } from '../scripts/release-ci-gate-publish.mjs';
import { ensureTagRefTarget } from '../scripts/release-ci-gate-tag.mjs';

const shaA = 'a'.repeat(40);
const shaB = 'b'.repeat(40);
const fullAssets = [
  { id: 1, name: 'SEOmi_0.4.40_aarch64.dmg', size: 1000 },
  { id: 2, name: 'SEOmi_0.4.40_aarch64.app.tar.gz', size: 2000 },
  { id: 3, name: 'SEOmi_0.4.40_aarch64.app.tar.gz.sig', size: 50 },
  { id: 4, name: 'SEOmi_0.4.40_x64.dmg', size: 1000 },
  { id: 5, name: 'SEOmi_0.4.40_x64.app.tar.gz', size: 2000 },
  { id: 6, name: 'SEOmi_0.4.40_x64.app.tar.gz.sig', size: 50 },
  { id: 7, name: 'SEOmi_0.4.40_x64_en-US.msi', size: 3000 },
  { id: 8, name: 'SEOmi_0.4.40_x64_en-US.msi.sig', size: 50 },
  { id: 9, name: 'SEOmi_0.4.40_x64-setup.exe', size: 3000 },
  { id: 10, name: 'SEOmi_0.4.40_x64-setup.exe.sig', size: 50 },
  { id: 11, name: 'latest.json', size: 500 },
];
const fullLatestJson = {
  version: '0.4.40',
  platforms: {
    'darwin-aarch64': { url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_0.4.40_aarch64.app.tar.gz', signature: 's1' },
    'darwin-x86_64': { url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_0.4.40_x64.app.tar.gz', signature: 's2' },
    'windows-x86_64': { url: 'https://github.com/o/r/releases/download/v0.4.40/SEOmi_0.4.40_x64-setup.exe', signature: 's3' },
  },
};

describe('release tag lifecycle and zero-patch gate verification', () => {
  it('blocks publication with zero PATCH calls when tag is retargeted to B', async () => {
    let patchCalled = false;
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'PATCH') { patchCalled = true; return { ok: true, status: 200 } as Response; }
      if (url.includes('/releases/123')) return { ok: true, status: 200, json: async () => ({ id: 123, tag_name: 'v0.4.40', draft: true, target_commitish: shaA, assets: fullAssets }) } as Response;
      if (url.includes('/git/ref/tags/v0.4.40')) return { ok: true, status: 200, json: async () => ({ object: { type: 'commit', sha: shaB } }) } as Response;
      return { ok: false, status: 404 } as Response;
    };
    await expect(verifyAndPublishDraftRelease({ repository: 'o/r', releaseId: 123, expectedSha: shaA, candidateVersion: '0.4.40', token: 'tok', fetchImpl }))
      .rejects.toThrow(`Release tag v0.4.40 points to ${shaB}, expected ${shaA}.`);
    expect(patchCalled).toBe(false);
  });

  it('fails closed on tag lookup errors without publication', async () => {
    let patchCalled = false;
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'PATCH') { patchCalled = true; return { ok: true, status: 200 } as Response; }
      if (url.includes('/releases/123')) return { ok: true, status: 200, json: async () => ({ id: 123, tag_name: 'v0.4.40', draft: true, target_commitish: shaA, assets: fullAssets }) } as Response;
      if (url.includes('/git/ref/tags/v0.4.40')) return { ok: false, status: 500 } as Response;
      return { ok: false, status: 404 } as Response;
    };
    await expect(verifyAndPublishDraftRelease({ repository: 'o/r', releaseId: 123, expectedSha: shaA, candidateVersion: '0.4.40', token: 'tok', fetchImpl }))
      .rejects.toThrow('Failed to check git ref for tag v0.4.40: HTTP 500');
    expect(patchCalled).toBe(false);
  });

  it('atomically creates git ref when missing and proceeds to publish', async () => {
    let refCreated = false;
    let published = false;
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/releases/123') && method === 'GET') return { ok: true, status: 200, json: async () => ({ id: 123, tag_name: 'v0.4.40', draft: true, target_commitish: shaA, assets: fullAssets }) } as Response;
      if (url.includes('/git/ref/tags/v0.4.40')) {
        return refCreated ? { ok: true, status: 200, json: async () => ({ object: { type: 'commit', sha: shaA } }) } as Response : { ok: false, status: 404 } as Response;
      }
      if (url.includes('/git/refs') && method === 'POST') { refCreated = true; return { ok: true, status: 201, json: async () => ({ ref: 'refs/tags/v0.4.40' }) } as Response; }
      if (url.includes('/releases?per_page=50')) return { ok: true, status: 200, json: async () => [] } as Response;
      if (url.includes('/assets/11')) return { ok: true, status: 200, text: async () => JSON.stringify(fullLatestJson) } as Response;
      if (url.includes('/assets/3')) return { ok: true, status: 200, text: async () => 's1' } as Response;
      if (url.includes('/assets/6')) return { ok: true, status: 200, text: async () => 's2' } as Response;
      if (url.includes('/assets/10')) return { ok: true, status: 200, text: async () => 's3' } as Response;
      if (url.includes('/releases/123') && method === 'PATCH') { published = true; return { ok: true, status: 200, json: async () => ({ id: 123, draft: false }) } as Response; }
      return { ok: false, status: 404 } as Response;
    };
    const res = await verifyAndPublishDraftRelease({ repository: 'o/r', releaseId: 123, expectedSha: shaA, candidateVersion: '0.4.40', token: 'tok', fetchImpl });
    expect(refCreated).toBe(true);
    expect(published).toBe(true);
    expect(res).toEqual({ id: 123, draft: false });
  });

  it('ensureTagRefTarget creates missing ref or verifies matching existing ref', async () => {
    let created = false;
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/git/ref/tags/v0.4.40')) return { ok: false, status: 404 } as Response;
      if (url.includes('/git/refs') && (init?.method ?? 'GET') === 'POST') { created = true; return { ok: true, status: 201 } as Response; }
      return { ok: false, status: 404 } as Response;
    };
    const res = await ensureTagRefTarget({ repository: 'o/r', tag: 'v0.4.40', expectedSha: shaA, token: 'tok', fetchImpl });
    expect(created).toBe(true);
    expect(res.commitSha).toBe(shaA);
  });
});
