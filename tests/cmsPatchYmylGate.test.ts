import { describe, expect, it } from 'vitest';
import { validateYmylClaim } from '@/services/llmEconomy/factGate';
import { applyPatch, type ApplyDeps } from '@/services/cmsPatch/apply';
import { planPatch } from '@/services/cmsPatch/plan';
import { memoryStore, mockCms, target } from './fixtures/cmsMock';

const makeDeps = (role: 'developer' = 'developer') => {
  const cms = mockCms('wordpress');
  const store = memoryStore();
  let saved = 0;
  const deps: ApplyDeps = {
    send: cms.send,
    store,
    ctx: { actor: 'alice', role, projectId: 'p1' },
    saveBackup: async () => void saved++,
  };
  return { cms, store, deps, saved: () => saved };
};

describe('deterministic YMYL fact gate for CMS writes', () => {
  it('blocks unverified numeric medical dosages before human approval', async () => {
    const s = makeDeps();
    const before = 'Patients take 200 mg ibuprofen twice daily.';
    s.cms.state.content = `<h2>Dosage</h2><p>${before}</p>`;

    const hallucinatedReplacement = '<p>Patients take 800 mg ibuprofen right now.</p>';
    const gate = validateYmylClaim(hallucinatedReplacement, [before]);
    expect(gate.allowed).toBe(false);
    expect(gate.rejectedValues).toContain('800mg');
    expect(gate.needsHumanApproval).toBe(true);

    const plan = await planPatch({
      target: target('wordpress'),
      heading: 'Dosage',
      replacement: hallucinatedReplacement,
      ymyl: true,
    }, s.cms.send);

    await expect(applyPatch(plan, { approvedBy: 'alice', planHash: plan.planHash }, s.deps))
      .rejects.toMatchObject({ code: 'fact-gate-required' });
  });

  it('refuses write even when caller forces factGatePassed: true on unsupported YMYL claims', async () => {
    const s = makeDeps();
    s.cms.state.content = '<h2>Dosage</h2><p>Standard intake is 200 mg.</p>';

    const plan = await planPatch({
      target: target('wordpress'),
      heading: 'Dosage',
      replacement: '<p>Standard intake is 999 mg right now.</p>',
      ymyl: true,
    }, s.cms.send);

    // Caller forces factGatePassed: true with human approval, but facts are unsupported in source
    await expect(applyPatch(plan, { approvedBy: 'alice', planHash: plan.planHash, factGatePassed: true }, s.deps))
      .rejects.toMatchObject({ code: 'fact-gate-required' });

    expect(s.saved()).toBe(0);
    expect(s.cms.state.requests.every((r) => r.method === 'GET')).toBe(true);
    expect(s.cms.state.content).toContain('200 mg');
    expect(s.cms.state.content).not.toContain('999 mg');
  });

  it('allows verified numeric claims once human approvals are provided', async () => {
    const s = makeDeps();
    const before = 'Fee is 100 PLN with 2,5% tax.';
    s.cms.state.content = `<h2>Pricing</h2><p>${before}</p>`;

    const verifiedReplacement = '<p>Updated fee remains 100 PLN with 2.5% tax.</p>';
    const gate = validateYmylClaim(verifiedReplacement, [before]);
    expect(gate.allowed).toBe(true);
    expect(gate.needsHumanApproval).toBe(true);

    const plan = await planPatch({
      target: target('wordpress'),
      heading: 'Pricing',
      replacement: verifiedReplacement,
      ymyl: true,
    }, s.cms.send);

    const reviewedSource = {
      sourceId: 'cms-reviewed-pricing',
      targetId: `${plan.target.baseUrl}\u0000${plan.target.contentId}`,
      planHash: plan.planHash,
      text: plan.before,
      revision: plan.baseRevision,
      reviewedBy: 'alice',
      reviewedAt: '2026-10-27T12:00:00.000Z',
    };

    const result = await applyPatch(
      plan,
      { approvedBy: 'alice', planHash: plan.planHash, factGatePassed: true, sources: [reviewedSource] },
      s.deps,
    );
    expect(result.status).toBe('verified');
  });

  it('ignores caller-supplied source text and binds the gate to the read revision', async () => {
    const s = makeDeps();
    s.cms.state.content = '<h2>Pricing</h2><p>Fee is 100 PLN.</p>';
    const plan = await planPatch({ target: target('wordpress'), heading: 'Pricing', replacement: '<p>Fee is 999 PLN.</p>', ymyl: true }, s.cms.send);
    const approval = { approvedBy: 'alice', planHash: plan.planHash, factGatePassed: true, sources: ['Fee is 999 PLN.'] } as never;
    await expect(applyPatch(plan, approval, s.deps)).rejects.toMatchObject({ code: 'fact-gate-required' });
    expect(s.saved()).toBe(0);
  });
});
