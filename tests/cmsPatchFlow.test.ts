import { describe, expect, it, vi } from 'vitest';
import { applyPatch, rollbackPatch, type ApplyDeps, type Backup } from '@/services/cmsPatch/apply';
import { planPatch } from '@/services/cmsPatch/plan';
import type { CmsKind } from '@/services/cmsPatch/types';
import { readAuditLog } from '@/services/team/auditStore';
import type { Role } from '@/services/team/roles';
import { memoryStore, mockCms, target } from './fixtures/cmsMock';

const setup = (kind: CmsKind, role: Role = 'developer') => {
  const cms = mockCms(kind);
  const store = memoryStore();
  const backups: Backup[] = [];
  const onApplied = vi.fn();
  const deps: ApplyDeps = { send: cms.send, store, ctx: { actor: 'dev', role, projectId: 'p' }, saveBackup: async (b) => void backups.push(b), onApplied };
  const request = { target: target(kind), heading: 'Pricing', replacement: '<p>new</p>', ymyl: false };
  return { cms, store, backups, deps, request, onApplied };
};

describe.each<CmsKind>(['wordpress', 'strapi', 'webhook'])('%s patch flow', (kind) => {
  it('plans a dry-run diff without writing', async () => {
    const s = setup(kind);
    const plan = await planPatch(s.request, s.cms.send);
    expect(plan.diff.some((l) => l.kind === 'add' && l.text.includes('new'))).toBe(true);
    expect(plan.after).toContain('<h2>FAQ</h2>');
    expect(s.cms.state.requests.every((r) => r.method === 'GET')).toBe(true);
    expect(s.cms.state.requests.every((r) => r.credential === 'cms-key' && !('Authorization' in r.headers) && !r.followRedirects)).toBe(true);
  });

  it('applies an approved plan with If-Match, backup, verification and audit', async () => {
    const s = setup(kind);
    const plan = await planPatch(s.request, s.cms.send);
    const result = await applyPatch(plan, { approvedBy: 'ann', planHash: plan.planHash }, s.deps);
    expect(result.status).toBe('verified');
    expect(s.cms.state.content).toContain('<p>new</p>');
    expect(s.cms.state.content).toContain('<p>faq</p>');
    expect(s.backups[0].content).toContain('old');
    expect(s.cms.state.requests.find((r) => r.method !== 'GET')?.headers['If-Match']).toBe('1');
    expect(s.onApplied).toHaveBeenCalledOnce();
    expect(readAuditLog(s.store).map((e) => `${e.action}:${e.result}`)).toEqual(['execute_cms_patch:success', 'cms_patch:success']);
  });

  it('rolls back to the backup', async () => {
    const s = setup(kind);
    const plan = await planPatch(s.request, s.cms.send);
    const { backup } = await applyPatch(plan, { approvedBy: 'ann', planHash: plan.planHash }, s.deps);
    await rollbackPatch(backup as Backup, s.deps);
    expect(s.cms.state.content).toContain('<p>old</p>');
    expect(readAuditLog(s.store).at(-1)?.action).toBe('cms_rollback');
  });

  it('refuses to write when the page changed after approval (conflict)', async () => {
    const s = setup(kind);
    const plan = await planPatch(s.request, s.cms.send);
    s.cms.state.rev += 1;
    await expect(applyPatch(plan, { approvedBy: 'ann', planHash: plan.planHash }, s.deps)).rejects.toMatchObject({ code: 'conflict' });
    expect(s.cms.state.content).toContain('old');
    expect(s.backups).toHaveLength(0);
  });

  it('maps a concurrent edit between recheck and write to a server conflict', async () => {
    const s = setup(kind);
    const plan = await planPatch(s.request, s.cms.send);
    s.cms.state.editBeforeWrite = true;
    await expect(applyPatch(plan, { approvedBy: 'ann', planHash: plan.planHash }, s.deps)).rejects.toMatchObject({ code: 'conflict' });
    expect(s.cms.state.content).toContain('old');
    expect(readAuditLog(s.store).at(-1)).toMatchObject({ action: 'cms_patch', result: 'failure' });
  });
});
