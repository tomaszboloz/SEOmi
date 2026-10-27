import { expect, it, vi } from 'vitest';
import { ADAPTERS } from '@/services/cmsPatch/adapters';
import { applyPatch, type ApplyDeps } from '@/services/cmsPatch/apply';
import { compactCrawlRunsForStorage } from '@/services/crawlPersistence/compaction';
import { planPatch } from '@/services/cmsPatch/plan';
import { patchSection } from '@/services/cmsPatch/patch';
import { readAuditLog } from '@/services/team/auditStore';
import { memoryStore, mockCms, target } from './fixtures/cmsMock';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

it('patches a final heading with no leading or trailing source whitespace', () => {
  expect(patchSection('<h2>Only</h2>old', 'Only', 'new').content).toBe('<h2>Only</h2>\nnew');
  expect(patchSection('<h2>Only</h2>\nold', 'Only', 'new').content).toBe('<h2>Only</h2>\nnew');
  expect(patchSection('<h2>Only</h2>   old', 'Only', 'new').content).toBe('<h2>Only</h2>   new');
  expect(patchSection('<h2>A</h2>old<h2>B</h2>', 'A', 'new').content).toBe('<h2>A</h2>\nnew\n<h2>B</h2>');
});

it.each([1, 2, 3] as const)('bounds focus terms at compaction level %i', (level) => {
  const page = createCrawlPageFixture({
    focus_terms: Array.from({ length: 150 }, (_, i) => ({
      term: `term-${i}`,
      surface: `term-${i}`,
      count: 1,
      weight: 1,
    })),
  });
  const run = createCrawlRunFixture({ result: createCrawlResultFixture({ pages: [page] }) });
  const stored = compactCrawlRunsForStorage([run], level)[0];
  expect(stored.storage_compacted).toBe(true);
  expect(stored.result.pages[0].focus_terms).toHaveLength(level === 1 ? 120 : level === 2 ? 60 : 30);
});

it('reads the Strapi v4 attributes envelope as well as the flat v5 envelope', async () => {
  const send = vi.fn(async (request: { method: string }) => ({
    status: 200, headers: {}, body: JSON.stringify({ data: { attributes: { content: request.method === 'GET' ? 'old' : 'new', updatedAt: '2' } } }),
  }));
  const t = { ...target('strapi'), collection: 'posts' };
  expect(await ADAPTERS.strapi.read(t, send)).toMatchObject({ content: 'old', revision: '2' });
  expect(await ADAPTERS.strapi.write(t, 'new', '2', send)).toEqual({ revision: '2' });
});

it('records a typed CMS transport failure separately from generic errors', async () => {
  const cms = mockCms('wordpress');
  const plan = await planPatch({ target: target('wordpress'), heading: 'Pricing', replacement: '<p>new</p>', ymyl: false }, cms.send);
  const send = async (request: Parameters<typeof cms.send>[0]) => request.method === 'POST'
    ? { status: 500, headers: {}, body: '' } : cms.send(request);
  const store = memoryStore();
  const deps: ApplyDeps = { send, store, ctx: { actor: 'dev', role: 'developer', projectId: 'p' }, saveBackup: vi.fn(async () => undefined) };
  await expect(applyPatch(plan, { approvedBy: 'a', planHash: plan.planHash }, deps)).rejects.toMatchObject({ code: 'http' });
  expect(readAuditLog(store).at(-1)).toMatchObject({ result: 'failure', metadata: { code: 'http' } });
});
