import { describe, expect, it } from 'vitest';
import { validateYmylClaim } from '@/services/llmEconomy/factGate';
import { applyPatch, type ApplyDeps } from '@/services/cmsPatch/apply';
import { planPatch } from '@/services/cmsPatch/plan';
import { memoryStore, mockCms, target } from './fixtures/cmsMock';

const depsFor = (cms: ReturnType<typeof mockCms>): ApplyDeps => ({
  send: cms.send,
  store: memoryStore(),
  ctx: { actor: 'alice', role: 'developer', projectId: 'cms-gate' },
  saveBackup: async () => undefined,
});

describe('CMS YMYL source and revision association', () => {
  it('requires a reviewed source bound to the exact plan and revision', async () => {
    const cms = mockCms('wordpress');
    cms.state.content = '<h2>Pricing</h2><p>Fee is 100 PLN.</p>';
    const plan = await planPatch({ target: target('wordpress'), heading: 'Pricing', replacement: '<p>Fee remains 100 PLN.</p>', ymyl: true }, cms.send);
    const deps = depsFor(cms);
    await expect(applyPatch(plan, { approvedBy: 'alice', planHash: plan.planHash, factGatePassed: true }, deps))
      .rejects.toMatchObject({ code: 'fact-gate-required' });

    const source = {
      sourceId: 'cms-reviewed-source',
      targetId: `${plan.target.baseUrl}\u0000${plan.target.contentId}`,
      planHash: plan.planHash,
      text: plan.before,
      revision: plan.baseRevision,
      reviewedBy: 'alice',
      reviewedAt: '2026-10-27T12:00:00.000Z',
    };
    expect(validateYmylClaim(plan.replacement, [source]).allowed).toBe(true);
    await expect(applyPatch(plan, { approvedBy: 'alice', planHash: plan.planHash, factGatePassed: true, sources: [source] }, deps))
      .resolves.toMatchObject({ status: 'verified' });
  });

  it('rejects a caller source that is not bound to the live revision', async () => {
    const cms = mockCms('wordpress');
    cms.state.content = '<h2>Pricing</h2><p>Fee is 100 PLN.</p>';
    const plan = await planPatch({ target: target('wordpress'), heading: 'Pricing', replacement: '<p>Fee is 999 PLN.</p>', ymyl: true }, cms.send);
    const deps = depsFor(cms);
    const source = {
      sourceId: 'fake', targetId: `${plan.target.baseUrl}\u0000${plan.target.contentId}`, planHash: plan.planHash,
      text: 'Fee is 999 PLN.', revision: plan.baseRevision, reviewedBy: 'alice', reviewedAt: '2026-10-27T12:00:00.000Z',
    };
    await expect(applyPatch(plan, { approvedBy: 'alice', planHash: plan.planHash, factGatePassed: true, sources: [source] }, deps))
      .rejects.toMatchObject({ code: 'fact-gate-required' });
    expect(cms.state.requests.every((request) => request.method === 'GET')).toBe(true);
  });
});
