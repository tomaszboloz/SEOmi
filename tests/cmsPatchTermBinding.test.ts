import { describe, expect, it } from 'vitest';
import { applyPatch } from '@/services/cmsPatch/apply';
import { planPatch } from '@/services/cmsPatch/plan';
import { buildTermDictionary } from '@/services/llmEconomy';
import { memoryStore, mockCms, target } from './fixtures/cmsMock';

const run = async (replacement: string, terms: boolean) => {
  const cms = mockCms('wordpress');
  cms.state.content = '<h2>Dosage</h2><p>Ibuprofen 200 mg. Paracetamol 500 mg.</p>';
  const plan = await planPatch({ target: target('wordpress'), heading: 'Dosage', replacement, ymyl: true }, cms.send);
  const source = {
    sourceId: 's1', targetId: `${plan.target.baseUrl}\u0000${plan.target.contentId}`, planHash: plan.planHash,
    text: plan.before, revision: plan.baseRevision, reviewedBy: 'alice', reviewedAt: '2026-10-27T12:00:00.000Z',
  };
  const dictionary = terms ? buildTermDictionary({ useMeshSeed: true, userText: '', userSource: '', importedAt: null }) ?? undefined : undefined;
  const deps = { send: cms.send, store: memoryStore(), ctx: { actor: 'alice', role: 'developer' as const, projectId: 'p1' }, saveBackup: async () => undefined };
  return applyPatch(plan, { approvedBy: 'alice', planHash: plan.planHash, factGatePassed: true, sources: [source], terms: dictionary }, deps);
};

describe('CMS write binds YMYL values to dictionary terms', () => {
  it('blocks a dose moved to the wrong drug when a dictionary is supplied', async () => {
    await expect(run('<p>Ibuprofen 500 mg.</p>', true)).rejects.toMatchObject({ code: 'fact-gate-required' });
  });

  it('accepts the correctly bound dose', async () => {
    expect((await run('<p>Ibuprofen 200 mg.</p>', true)).status).toBe('verified');
  });

  it('keeps the value-only check without a dictionary', async () => {
    expect((await run('<p>Ibuprofen 500 mg.</p>', false)).status).toBe('verified');
  });
});
