import { describe, expect, it } from 'vitest';
import { loadMainCodeqlEvidence } from '../scripts/release-codeql-main.mjs';
import { mainAnalyses, mainCodeqlFetch, mainSha, response } from './releaseMainCodeqlFixtures';

const options = { repository: 'owner/repo', sha: mainSha, token: 'test-token' };
const alertPath = '/repos/owner/repo/code-scanning/alerts';
const query = 'ref=refs%2Fheads%2Fmain&state=open&per_page=100&page=2';
const linked = (data: unknown, link: string) => new Response(JSON.stringify(data), { headers: { Link: link } });

describe('complete native CodeQL Link pagination', () => {
  it.each([`https://api.github.com${alertPath}?${query}`, `${alertPath}?${query}`])(
    'reads a short filtered page with a trusted next link: %s', async next => {
      const mock = mainCodeqlFetch(path => {
        if (!path.includes('/alerts?')) return;
        return path.endsWith('page=1') ? linked([], `<${next}>; rel="next"`)
          : response([{ number: 1, state: 'open' }]);
      });
      await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow('1 open alerts');
      expect(mock.requests.filter(r => r.url.includes('/alerts?'))).toHaveLength(2);
    },
  );

  it.each([
    `https://evil.test${alertPath}?${query}`, `http://api.github.com${alertPath}?${query}`,
    `https://api.github.com/repos/other/repo/code-scanning/alerts?${query}`,
    `https://api.github.com${alertPath}?${query.replace('page=2', 'page=1')}`,
    `https://api.github.com${alertPath}?${query.replace('state=open', 'state=dismissed')}`,
    `https://api.github.com${alertPath}?${query}&state=dismissed`,
  ])('rejects untrusted or incorrectly scoped next metadata: %s', async next => {
    const mock = mainCodeqlFetch(path => path.includes('/alerts?') ? linked([], `<${next}>; rel="next"`) : undefined);
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow(/pagination/i);
    expect(mock.requests.filter(r => r.url.includes('/alerts?'))).toHaveLength(1);
  });

  it.each(['malformed; rel="next"', `<${alertPath}?${query}>; rel="next", <${alertPath}?${query}>; rel="next"`])(
    'rejects malformed or ambiguous next metadata', async link => {
      const mock = mainCodeqlFetch(path => path.includes('/alerts?') ? linked([], link) : undefined);
      await expect(loadMainCodeqlEvidence({ ...options, ...mock })).rejects.toThrow(/pagination/i);
    },
  );

  it('reads a required analysis on a later short page', async () => {
    const next = '/repos/owner/repo/code-scanning/analyses?ref=refs%2Fheads%2Fmain&sort=created&direction=desc&per_page=100&page=2';
    const [actions, javascript] = mainAnalyses();
    const mock = mainCodeqlFetch(path => {
      if (!path.includes('/analyses?')) return;
      return path.endsWith('page=2') ? response([actions]) : linked([javascript], `<${next}>; rel="next"`);
    });
    await expect(loadMainCodeqlEvidence({ ...options, ...mock })).resolves.toMatchObject({ status: 'success' });
    expect(mock.requests.filter(r => r.url.includes('/analyses?'))).toHaveLength(2);
  });
});
