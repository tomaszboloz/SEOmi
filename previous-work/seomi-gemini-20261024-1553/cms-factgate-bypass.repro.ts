import { applyPatch } from '/Users/tomaszboloz/.codex/worktrees/release-next/seomi/src/services/cmsPatch/apply';
import { planPatch } from '/Users/tomaszboloz/.codex/worktrees/release-next/seomi/src/services/cmsPatch/plan';
import { memoryStore, mockCms, target } from '/Users/tomaszboloz/.codex/worktrees/release-next/seomi/tests/fixtures/cmsMock';

const cms = mockCms('wordpress');
const store = memoryStore();
const request = { target: target('wordpress'), heading: 'Pricing', replacement: '<p>Unverified 999 mg dose.</p>', ymyl: true };
const plan = await planPatch(request, cms.send);
const result = await applyPatch(plan, { approvedBy: 'actor', planHash: plan.planHash, factGatePassed: true }, {
  send: cms.send, store, ctx: { actor: 'actor', role: 'developer', projectId: 'project-a' }, saveBackup: async () => undefined,
});
if (result.status !== 'verified' || !cms.state.content.includes('999 mg')) throw new Error('reproduction failed');
console.log(JSON.stringify({ status: result.status, cmsChanged: cms.state.content.includes('999 mg'), writes: cms.state.requests.filter((r) => r.method !== 'GET').length, unsupportedValue: '999 mg', note: 'No gateFacts call or source set was required by applyPatch; caller forged factGatePassed=true.' }, null, 2));
