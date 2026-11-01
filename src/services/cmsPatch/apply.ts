import { authorize, type TeamContext } from '@/services/team/guard';
import type { KeyValueStore } from '@/services/team/auditStore';
import { recordAudit } from '@/services/team/auditStore';
import { isReviewedSource, validateYmylClaim, type YmylSource } from '@/services/llmEconomy/factGate';
import type { TermDictionary } from '@/services/llmEconomy/termBinding';
import { ADAPTERS } from './adapters';
import type { PatchPlan } from './plan';
import { CmsError, type CmsTarget, type CmsTransport } from './types';
import { sectionApplied } from './verify';

export interface Approval { approvedBy: string; planHash: string; factGatePassed?: boolean; sources?: YmylSource[]; terms?: TermDictionary }

export interface Backup { target: CmsTarget; content: string; revision: string; at: string }

export interface ApplyDeps {
  send: CmsTransport;
  store: KeyValueStore;
  ctx: TeamContext;
  /** Persists the previous version BEFORE any write; a failing save aborts the write. */
  saveBackup(backup: Backup): Promise<void>;
  /** Called after a verified write, e.g. to add a Closed-Loop Tracker task. */
  onApplied?(plan: PatchPlan, revision: string): void;
  now?: () => Date;
}

export type ApplyStatus = 'dry-run' | 'verified' | 'unverified';
export interface ApplyResult { status: ApplyStatus; revision?: string; backup?: Backup }

const audit = (deps: ApplyDeps, plan: PatchPlan, result: 'success' | 'failure' | 'dry_run' | 'denied', extra: Record<string, string | boolean> = {}) =>
  recordAudit(deps.store, { ...deps.ctx, action: 'cms_patch', result, metadata: { kind: plan.target.kind, contentId: plan.target.contentId, heading: plan.heading, planHash: plan.planHash, ...extra } }, deps.now?.());

/** Applies a human-approved plan. Order: permission, approval, fact gate, revision recheck, backup, write, verify. */
export const applyPatch = async (plan: PatchPlan, approval: Approval | null, deps: ApplyDeps, options: { dryRun?: boolean } = {}): Promise<ApplyResult> => {
  const { allowed } = await authorize(deps.store, deps.ctx, 'execute_cms_patch', { contentId: plan.target.contentId });
  if (!allowed) throw new CmsError('forbidden', 'Role may not apply CMS patches');
  const fail = async (code: CmsError['code'], message: string): Promise<never> => {
    await audit(deps, plan, 'failure', { code });
    throw new CmsError(code, message);
  };
  if (options.dryRun) {
    await audit(deps, plan, 'dry_run');
    return { status: 'dry-run' };
  }
  if (!approval || approval.planHash !== plan.planHash) return fail('not-approved', 'A human approval for this exact diff is required');
  if (plan.ymyl && !approval.factGatePassed) return fail('fact-gate-required', 'YMYL content needs a passed fact gate with reviewed sources');
  const adapter = ADAPTERS[plan.target.kind];
  const current = await adapter.read(plan.target, deps.send);
  if (current.revision !== plan.baseRevision) return fail('conflict', 'The page changed after the diff was approved');
  if (plan.ymyl) {
    const targetId = `${plan.target.baseUrl}\u0000${plan.target.contentId}`;
    const sources = (approval.sources ?? []).filter((source) => isReviewedSource(source)
      && source.revision === current.revision
      && source.planHash === plan.planHash
      && source.targetId === targetId
      && source.sourceId.trim().length > 0
      && current.content.includes(source.text));
    const check = validateYmylClaim(plan.replacement, sources, approval.terms);
    if (!sources.length || !check.allowed) return fail('fact-gate-required', `Unsupported numeric claims: ${check.rejectedValues.join(', ') || 'reviewed source required'}`);
  }
  const backup: Backup = { target: plan.target, content: current.content, revision: current.revision, at: (deps.now?.() ?? new Date()).toISOString() };
  await deps.saveBackup(backup);
  try {
    const written = await adapter.write(plan.target, plan.after, plan.baseRevision, deps.send);
    const check = await adapter.read(plan.target, deps.send);
    const ok = sectionApplied(check.content, plan.replacement);
    await audit(deps, plan, ok ? 'success' : 'failure', { approvedBy: approval.approvedBy, revision: written.revision, verified: ok });
    if (ok) deps.onApplied?.(plan, written.revision);
    return { status: ok ? 'verified' : 'unverified', revision: written.revision, backup };
  } catch (error) {
    await audit(deps, plan, 'failure', { code: error instanceof CmsError ? error.code : 'unknown' });
    throw error;
  }
};

/** Restores the backed-up content, writing against the CURRENT revision so a newer edit is not silently lost. */
export const rollbackPatch = async (backup: Backup, deps: ApplyDeps): Promise<{ revision: string }> => {
  const { allowed } = await authorize(deps.store, deps.ctx, 'execute_cms_patch', { contentId: backup.target.contentId, rollback: true });
  if (!allowed) throw new CmsError('forbidden', 'Role may not apply CMS patches');
  const adapter = ADAPTERS[backup.target.kind];
  const current = await adapter.read(backup.target, deps.send);
  const written = await adapter.write(backup.target, backup.content, current.revision, deps.send);
  await recordAudit(deps.store, { ...deps.ctx, action: 'cms_rollback', result: 'success', metadata: { contentId: backup.target.contentId, revision: written.revision } }, deps.now?.());
  return written;
};
