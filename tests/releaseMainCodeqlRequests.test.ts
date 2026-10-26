import { describe, expect, it } from 'vitest';
import { loadMainCodeqlEvidence } from '../scripts/release-codeql-main.mjs';
import { mainAnalyses, mainCodeqlFetch, mainHead, mainSha, otherSha, response } from './releaseMainCodeqlFixtures';

const options = { repository: 'owner/repo', sha: mainSha, token: 'test-token' };

describe('main CodeQL evidence API boundaries', () => {
  it('uses fixed authenticated origins, refuses redirects and performs only reads', async () => {
    const mock = mainCodeqlFetch();
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).resolves.toMatchObject({ status: 'success' });
    expect(mock.requests).toHaveLength(4);
    for (const request of mock.requests) {
      expect(request.url).toMatch(/^https:\/\/api\.github\.com\/repos\/owner\/repo\//);
      expect(request.init?.method ?? 'GET').toBe('GET');
      expect(request.init?.redirect).toBe('error');
      expect(request.init?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
    }
  });

  it.each([
    { apiUrl: 'https://evil.test' }, { repository: '../other' }, { sha: 'bad' }, { token: '' },
  ])('rejects untrusted context before sending credentials: %j', async change => {
    const mock = mainCodeqlFetch();
    await expect(loadMainCodeqlEvidence({ ...options, ...change, ...mock })).rejects.toThrow();
    expect(mock.requests).toEqual([]);
  });

  it.each([403, 503])('fails closed on HTTP %i', async status => {
    const mock = mainCodeqlFetch(() => response({ message: 'unavailable' }, status));
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow(`HTTP ${status}`);
    expect(mock.requests).toHaveLength(1);
  });

  it('rejects malformed JSON', async () => {
    const mock = mainCodeqlFetch(() => new Response('{'));
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow();
  });

  it('rejects a main SHA change while reading analysis and alerts', async () => {
    let reads = 0;
    const mock = mainCodeqlFetch(path => path === 'git/ref/heads/main'
      ? response(mainHead(++reads === 1 ? mainSha : otherSha)) : undefined);
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow('main ref');
    expect(reads).toBe(2);
  });

  it.each([{}, null, 'bad'])('rejects malformed analysis inventories: %j', async bad => {
    const mock = mainCodeqlFetch(path => path.startsWith('code-scanning/analyses?') ? response(bad) : undefined);
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow('analysis list');
  });

  it('refuses out-of-order, duplicate and invalid analysis metadata', async () => {
    const current = mainAnalyses();
    const cases = [
      [{ ...current[0], created_at: '2026-10-25T03:20:08Z' }, current[1]],
      [current[0], current[0]], [{ ...current[0], id: 0 }],
    ];
    for (const analyses of cases) {
      const mock = mainCodeqlFetch(path => path.startsWith('code-scanning/analyses?') ? response(analyses) : undefined);
      await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow('CodeQL');
    }
  });

  it('reads the next alert page before accepting an inventory', async () => {
    const alerts = Array.from({ length: 100 }, (_, i) => ({ number: i + 1, state: 'open' }));
    const mock = mainCodeqlFetch(path => path.includes('code-scanning/alerts?')
      ? response(path.endsWith('page=1') ? alerts : [{ number: 101, state: 'open' }]) : undefined);
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow('101 open alerts');
    expect(mock.requests.filter(r => r.url.includes('/alerts?'))).toHaveLength(2);
  });

  it.each([{}, null, 'bad'])('rejects malformed alert pages: %j', async bad => {
    const mock = mainCodeqlFetch(path => path.includes('code-scanning/alerts?') ? response(bad) : undefined);
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow('alert list');
  });

  it('blocks duplicated alert pages', async () => {
    const alerts = Array.from({ length: 100 }, (_, i) => ({ number: i + 1, state: 'open' }));
    const mock = mainCodeqlFetch(path => path.includes('code-scanning/alerts?') ? response(alerts) : undefined);
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow('duplicate');
  });
});
