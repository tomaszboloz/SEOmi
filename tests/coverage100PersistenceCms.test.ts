import { describe, expect, it, vi } from 'vitest';
import { ADAPTERS } from '@/services/cmsPatch/adapters';
import { applyPatch, type ApplyDeps } from '@/services/cmsPatch/apply';
import { planPatch } from '@/services/cmsPatch/plan';
import type { CmsTransport } from '@/services/cmsPatch/types';
import { readAuditLog } from '@/services/team/auditStore';
import { memoryStore, mockCms, target } from './fixtures/cmsMock';

const request = { target: target('wordpress'), heading: 'Pricing', replacement: '<p>new</p>', ymyl: false };

const depsFor = (send: ApplyDeps['send'], store = memoryStore()): ApplyDeps => ({
  send,
  store,
  ctx: { actor: 'dev', role: 'developer', projectId: 'p' },
  saveBackup: vi.fn(async () => undefined),
});

describe('CMS patch failure recovery', () => {
  it('does not write when persisting the pre-write backup fails', async () => {
    const cms = mockCms('wordpress');
    const store = memoryStore();
    const plan = await planPatch(request, cms.send);
    const deps = { ...depsFor(cms.send, store), saveBackup: vi.fn(async () => { throw new Error('backup disk full'); }) };
    await expect(applyPatch(plan, { approvedBy: 'a', planHash: plan.planHash }, deps)).rejects.toThrow('backup disk full');
    expect(cms.state.content).toContain('old');
    expect(cms.state.requests.filter((r) => r.method !== 'GET')).toHaveLength(0);
  });

  it('audits an unexpected transport failure and rethrows the original error', async () => {
    const cms = mockCms('wordpress');
    const store = memoryStore();
    const plan = await planPatch(request, cms.send);
    const network = new Error('network down');
    const send = vi.fn(async (req: Parameters<typeof cms.send>[0]) => {
      if (req.method === 'POST') throw network;
      return cms.send(req);
    });
    await expect(applyPatch(plan, { approvedBy: 'a', planHash: plan.planHash }, depsFor(send, store))).rejects.toBe(network);
    expect(readAuditLog(store).at(-1)).toMatchObject({ action: 'cms_patch', result: 'failure', metadata: { code: 'unknown' } });
  });
});

describe('Strapi v5 flat response adapter', () => {
  it('reads and writes flat data while sending only the content field', async () => {
    let revision = 1;
    const requests: Array<{ method: string; body?: string }> = [];
    const send: CmsTransport = async (req) => {
      requests.push({ method: req.method, body: req.body });
      if (req.method === 'GET') return { status: 200, headers: {}, body: JSON.stringify({ data: { content: 'old', title: 'T', updatedAt: String(revision) } }) };
      revision += 1;
      return { status: 200, headers: {}, body: JSON.stringify({ data: { content: 'new', updatedAt: String(revision) } }) };
    };
    const doc = await ADAPTERS.strapi.read({ ...target('strapi'), collection: 'posts' }, send);
    expect(doc).toEqual({ content: 'old', title: 'T', revision: '1' });
    expect(await ADAPTERS.strapi.write({ ...target('strapi'), collection: 'posts' }, 'new', '1', send)).toEqual({ revision: '2' });
    expect(JSON.parse(requests[1].body ?? '{}')).toEqual({ data: { content: 'new' } });
  });
});
