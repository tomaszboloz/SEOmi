import { useEffect, useRef, useState } from 'react';
import { applyPatch, type Approval, type ApplyStatus } from '@/services/cmsPatch/apply';
import { hasChanges } from '@/services/cmsPatch/diff';
import { planPatch, type PatchPlan } from '@/services/cmsPatch/plan';
import { assertSafeCmsUrl } from '@/services/cmsPatch/ssrf';
import { cmsTransport } from '@/services/cmsPatch/transport';
import { CmsError } from '@/services/cmsPatch/types';
import { loadTermDictionary } from '@/services/llmEconomy/dictionaryStore';
import { validateYmylClaim, type YmylSource } from '@/services/llmEconomy';
import { deniedMessage, enforcePermission } from '@/services/team/enforce';
import { readIdentity } from '@/services/team/identity';
import { cmsPanelError, initialCmsFields, saveCmsBackup, type CmsPanelFields } from './cmsPanelState';

export const useCmsPatchPanel = (projectId: string | null) => {
  const [fields, setFields] = useState(initialCmsFields);
  const [plan, setPlan] = useState<PatchPlan | null>(null);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [factGatePassed, setFactGatePassed] = useState(false);
  const [factSources, setFactSources] = useState<YmylSource[]>([]);
  const [dryRunHash, setDryRunHash] = useState<string | null>(null);
  const [status, setStatus] = useState<ApplyStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const running = useRef(false);
  useEffect(() => () => { generation.current += 1; }, []);

  const invalidate = () => {
    generation.current += 1;
    setPlan(null);
    setApproval(null);
    setFactGatePassed(false);
    setFactSources([]);
    setDryRunHash(null);
    setStatus(null);
    setError(null);
    setBusy(false);
  };
  const update = <Key extends keyof CmsPanelFields>(key: Key, value: CmsPanelFields[Key]) => {
    invalidate();
    setFields((current) => ({ ...current, [key]: value }));
  };
  const ready = !!projectId && !!fields.contentId.trim() && !!fields.baseUrl.trim()
    && !!fields.heading.trim() && !!fields.replacement.trim()
    && (fields.kind !== 'strapi' || !!fields.collection.trim());

  const prepare = async () => {
    if (!ready || running.current) return;
    invalidate();
    const current = generation.current;
    running.current = true;
    setBusy(true);
    try {
      const baseUrl = assertSafeCmsUrl(fields.baseUrl.trim()).toString();
      const next = await planPatch({
        target: { kind: fields.kind, baseUrl, contentId: fields.contentId.trim(),
          credential: fields.credential.trim(), collection: fields.collection.trim() },
        heading: fields.heading.trim(), replacement: fields.replacement, ymyl: fields.ymyl,
      }, cmsTransport);
      if (current === generation.current) setPlan(next);
    } catch (reason) {
      if (current === generation.current) setError(cmsPanelError(reason));
    } finally {
      running.current = false;
      if (current === generation.current) setBusy(false);
    }
  };
  const approve = (checked: boolean) => {
    setApproval(checked && plan ? { approvedBy: readIdentity().actor, planHash: plan.planHash, factGatePassed, sources: factSources, terms: loadTermDictionary() ?? undefined } : null);
    setDryRunHash(null);
    setStatus(null);
    setError(null);
  };
  const confirmFacts = (checked: boolean) => {
    if (checked && plan?.ymyl) {
      const identity = readIdentity();
      const source: YmylSource = {
        sourceId: `${plan.target.baseUrl}\u0000${plan.target.contentId}`,
        targetId: `${plan.target.baseUrl}\u0000${plan.target.contentId}`,
        planHash: plan.planHash,
        text: plan.before,
        revision: plan.baseRevision,
        reviewedBy: identity.actor,
        reviewedAt: new Date().toISOString(),
      };
      const check = validateYmylClaim(plan.replacement, [source], loadTermDictionary() ?? undefined);
      if (!check.allowed) {
        setFactGatePassed(false);
        setFactSources([]);
        setError(cmsPanelError(new CmsError('fact-gate-required', check.rejectedValues.join(', '))));
        return;
      }
      setFactSources([source]);
    }
    if (!checked) setFactSources([]);
    setFactGatePassed(checked);
    approve(false);
  };
  const execute = async (dryRun: boolean) => {
    if (!projectId || !plan || !approval || running.current || (!dryRun && dryRunHash !== plan.planHash)) return;
    setError(null);
    setStatus(null);
    if (!enforcePermission('execute_cms_patch')) { setError(deniedMessage()); return; }
    if (approval.approvedBy !== readIdentity().actor) {
      approve(false);
      setError(cmsPanelError(new CmsError('not-approved', '')));
      return;
    }
    const current = generation.current;
    running.current = true;
    setBusy(true);
    try {
      const result = await applyPatch(plan, approval, {
        send: cmsTransport, store: localStorage, ctx: { ...readIdentity(), projectId },
        saveBackup: (backup) => saveCmsBackup(projectId, backup),
      }, { dryRun });
      if (current !== generation.current) return;
      setStatus(result.status);
      setDryRunHash(dryRun ? plan.planHash : null);
      if (!dryRun) setApproval(null);
    } catch (reason) {
      if (current === generation.current) { setError(cmsPanelError(reason)); setDryRunHash(null); }
    } finally {
      running.current = false;
      if (current === generation.current) setBusy(false);
    }
  };
  return { fields, update, plan, approval, factGatePassed, confirmFacts, approve, prepare, execute,
    status, error, busy, ready, changed: !!plan && hasChanges(plan.diff), dryRunHash };
};

export type CmsPanelController = ReturnType<typeof useCmsPatchPanel>;
