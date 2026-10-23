import { describe, expect, it } from 'vitest';
import { applyPatch, rollbackPatch, type ApplyDeps } from '@/services/cmsPatch/apply';
import { call, json } from '@/services/cmsPatch/http';
import { planPatch } from '@/services/cmsPatch/plan';
import { CmsError } from '@/services/cmsPatch/types';
import { readAuditLog } from '@/services/team/auditStore';
import { memoryStore, mockCms, target } from './fixtures/cmsMock';

const make = (role: 'developer' | 'content_writer' = 'developer', ymyl = false) => {
  const cms = mockCms('wordpress');
  const store = memoryStore();
  let saved = 0;
  const deps: ApplyDeps = { send: cms.send, store, ctx: { actor: 'u', role, projectId: 'p' }, saveBackup: async () => void saved++ };
  const request = { target: target('wordpress'), heading: 'Pricing', replacement: '<p>new</p>', ymyl };
  return { cms, store, deps, request, saved: () => saved };
};

describe('approval and role gates', () => {
  it('denies and logs a role without execute_cms_patch; nothing is read or written', async () => {
    const s = make('content_writer');
    const plan = await planPatch(s.request, s.cms.send);
    const reads = s.cms.state.requests.length;
    await expect(applyPatch(plan, { approvedBy: 'a', planHash: plan.planHash }, s.deps)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(rollbackPatch({ target: s.request.target, content: 'x', revision: '1', at: 't' }, s.deps)).rejects.toMatchObject({ code: 'forbidden' });
    expect(s.cms.state.requests).toHaveLength(reads);
    expect(readAuditLog(s.store)[0]).toMatchObject({ result: 'denied' });
  });
  it('requires an approval bound to this exact diff', async () => {
    const s = make();
    const plan = await planPatch(s.request, s.cms.send);
    await expect(applyPatch(plan, null, s.deps)).rejects.toMatchObject({ code: 'not-approved' });
    await expect(applyPatch(plan, { approvedBy: 'a', planHash: 'stale' }, s.deps)).rejects.toMatchObject({ code: 'not-approved' });
    expect(s.cms.state.content).toContain('old');
    expect(s.saved()).toBe(0);
  });
  it('blocks YMYL writes without a passed fact gate, allows them with it', async () => {
    const s = make('developer', true);
    const plan = await planPatch(s.request, s.cms.send);
    await expect(applyPatch(plan, { approvedBy: 'a', planHash: plan.planHash }, s.deps)).rejects.toMatchObject({ code: 'fact-gate-required' });
    const ok = await applyPatch(plan, { approvedBy: 'a', planHash: plan.planHash, factGatePassed: true }, s.deps);
    expect(ok.status).toBe('verified');
  });
  it('dry-run audits and writes nothing', async () => {
    const s = make();
    const plan = await planPatch(s.request, s.cms.send);
    expect(await applyPatch(plan, null, s.deps, { dryRun: true })).toEqual({ status: 'dry-run' });
    expect(readAuditLog(s.store).at(-1)?.result).toBe('dry_run');
    expect(s.cms.state.requests.every((r) => r.method === 'GET')).toBe(true);
  });
  it('reports unverified when the CMS silently drops the change, and logs a write error', async () => {
    const s = make();
    const plan = await planPatch(s.request, s.cms.send);
    const real = s.cms.send;
    let writes = 0;
    s.deps.send = async (r) => { if (r.method !== 'GET') { writes++; return { status: 200, headers: {}, body: JSON.stringify({ modified_gmt: '9' }) }; } return real(r); };
    expect((await applyPatch(plan, { approvedBy: 'a', planHash: plan.planHash }, s.deps)).status).toBe('unverified');
    s.deps.send = async (r) => (r.method === 'GET' ? real(r) : { status: 500, headers: {}, body: '' });
    await expect(applyPatch(plan, { approvedBy: 'a', planHash: plan.planHash }, s.deps)).rejects.toMatchObject({ code: 'http', status: 500 });
    expect(writes).toBe(1);
  });
});

describe('transport errors and SSRF', () => {
  it('rejects private hosts before any request is sent', async () => {
    const s = make();
    const bad = { ...s.request, target: { ...s.request.target, baseUrl: 'https://169.254.169.254' } };
    await expect(planPatch(bad, s.cms.send)).rejects.toMatchObject({ code: 'unsafe-url' });
    expect(s.cms.state.requests).toHaveLength(0);
  });
  it('maps http errors and malformed bodies', async () => {
    const t = target('wordpress');
    const reply = (status: number, body: string) => async () => ({ status, headers: {}, body });
    await expect(call(reply(500, ''), t, 'GET', 'https://x.test')).rejects.toMatchObject({ code: 'http' });
    await expect(call(reply(302, ''), t, 'GET', 'https://x.test')).rejects.toMatchObject({ code: 'http' });
    expect(() => json({ status: 200, headers: {}, body: '[1]' })).toThrow(CmsError);
    expect(() => json({ status: 200, headers: {}, body: 'nope' })).toThrow(CmsError);
    const s = mockCms('wordpress');
    s.state.status = 404;
    await expect(planPatch({ target: t, heading: 'x', replacement: 'y', ymyl: false }, s.send)).rejects.toMatchObject({ code: 'http', status: 404 });
  });
  it('rejects responses missing required fields', async () => {
    const empty = async () => ({ status: 200, headers: {}, body: '{}' });
    for (const kind of ['wordpress', 'strapi', 'webhook'] as const) {
      await expect(planPatch({ target: target(kind), heading: 'x', replacement: 'y', ymyl: false }, empty)).rejects.toMatchObject({ code: 'bad-response' });
    }
  });
});
