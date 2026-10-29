import { describe, expect, it } from 'vitest';
import { applyPatch } from '/Users/tomaszboloz/.codex/worktrees/release-next/seomi/src/services/cmsPatch/apply';
import { planPatch } from '/Users/tomaszboloz/.codex/worktrees/release-next/seomi/src/services/cmsPatch/plan';
import { memoryStore, mockCms, target } from '/Users/tomaszboloz/.codex/worktrees/release-next/seomi/tests/fixtures/cmsMock';

describe('baseline #137 fact-gate bypass', () => {
  it('writes unsupported YMYL value when caller forges factGatePassed=true', async () => {
    const cms = mockCms('wordpress');
    const store = memoryStore();
    const request = { target: target('wordpress'), heading: 'Pricing', replacement: '<p>Unverified 999 mg dose.</p>', ymyl: true };
    const plan = await planPatch(request, cms.send);
    const result = await applyPatch(plan, { approvedBy: 'actor', planHash: plan.planHash, factGatePassed: true }, {
      send: cms.send, store, ctx: { actor: 'actor', role: 'developer', projectId: 'project-a' }, saveBackup: async () => undefined,
    });
    expect(result.status).toBe('verified');
    expect(cms.state.content).toContain('999 mg');
  });
});
