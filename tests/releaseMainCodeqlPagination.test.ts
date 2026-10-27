import { describe, expect, it } from 'vitest';
import { loadMainCodeqlEvidence } from '../scripts/release-codeql-main.mjs';
import { mainAnalyses, mainCodeqlFetch, mainHead, mainSha, otherSha, response } from './releaseMainCodeqlFixtures';

const options = { repository: 'owner/repo', sha: mainSha, token: 'test-token' };
const pageAlerts = (page: number) => Array.from({ length: 100 }, (_, i) => ({ number: (page - 1) * 100 + i + 1, state: 'open' }));

describe('main CodeQL incomplete inventory rejection', () => {
  it('rejects a stale main ref before reading scans', async () => {
    const mock = mainCodeqlFetch(path => path === 'git/ref/heads/main' ? response(mainHead(otherSha)) : undefined);
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow('main ref');
    expect(mock.requests).toHaveLength(1);
  });

  it('does not follow an untrusted redirect', async () => {
    const mock = mainCodeqlFetch(() => new Response(null, { status: 302, headers: { Location: 'https://evil.test' } }));
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow('HTTP 302');
    expect(mock.requests).toHaveLength(1);
    expect(mock.requests[0].init?.redirect).toBe('error');
  });

  it('rejects an oversized analysis response', async () => {
    const analyses = Array.from({ length: 101 }, (_, id) => ({ ...mainAnalyses()[0], id: id + 1 }));
    const mock = mainCodeqlFetch(path => path.includes('/analyses?') ? response(analyses) : undefined);
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow('analysis list');
  });

  it('rejects an oversized alert page', async () => {
    const mock = mainCodeqlFetch(path => path.includes('/alerts?') ? response([...pageAlerts(1), { number: 101, state: 'open' }]) : undefined);
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow('alert list');
  });

  it.each([403, 503])('does not treat HTTP %i on a later page as an empty inventory', async status => {
    const mock = mainCodeqlFetch(path => {
      if (!path.includes('/alerts?')) return;
      return path.endsWith('page=1') ? response(pageAlerts(1)) : response({}, status);
    });
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow(`HTTP ${status}`);
    expect(mock.requests.filter(r => r.url.includes('/alerts?'))).toHaveLength(2);
  });

  it('rejects malformed JSON on a later alert page', async () => {
    const mock = mainCodeqlFetch(path => {
      if (!path.includes('/alerts?')) return;
      return path.endsWith('page=1') ? response(pageAlerts(1)) : new Response('{');
    });
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow();
  });

  it('bounds a server that keeps returning full unique pages', async () => {
    const mock = mainCodeqlFetch(path => {
      if (!path.includes('/alerts?')) return;
      return response(pageAlerts(Number(new URL('https://api.github.com/' + path).searchParams.get('page'))));
    });
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow('pagination exceeded');
    expect(mock.requests.filter(r => r.url.includes('/alerts?'))).toHaveLength(100);
  });
});
