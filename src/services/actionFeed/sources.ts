import type { TrustReport } from '@/services/eeatTrust';
import type { InternalLinkOpportunity } from '@/services/internalLinkOpportunities';
import type { SiteFocusReport } from '@/services/siteFocus';
import type { TopicalAuthorityReport } from '@/services/topicalAuthority';
import { actionId } from './identity';
import type { ActionDrillTab, ActionEffort, ActionEvidence, ActionSource, ExecutiveAction, ModuleDelta } from './types';

export interface ActionScope { projectId: string; runId: string }

interface Draft { type: string; source: ActionSource; urls: string[]; evidence: ActionEvidence[]; effort: ActionEffort | null; moduleDelta: ModuleDelta | null; drillTab: ActionDrillTab; ordered?: boolean }

const finish = (scope: ActionScope, draft: Draft): ExecutiveAction => ({
  id: actionId(scope.projectId, scope.runId, draft.type, draft.urls, draft.ordered),
  type: draft.type, source: draft.source, urls: draft.urls, evidence: draft.evidence, effort: draft.effort,
  moduleDelta: draft.moduleDelta, hssDelta: null, conflicts: [], dependsOn: [], blocked: false, drillTab: draft.drillTab,
});

const effortOf = (effort: { minHours: number; maxHours: number } | undefined): ActionEffort | null =>
  effort && Number.isFinite(effort.minHours) && Number.isFinite(effort.maxHours) ? { minHours: effort.minHours, maxHours: effort.maxHours, estimate: true } : null;

/** SFS site actions: deltaScore comes from the SFS engine's own removal/improvement simulation. */
export const sfsActions = (scope: ActionScope, sfs: SiteFocusReport | null | undefined): ExecutiveAction[] => {
  if (!sfs || sfs.unavailable) return [];
  const recs = sfs.recommendations.map((rec) => finish(scope, {
    type: `sfs:${rec.code}`, source: 'sfs', urls: [...rec.urls], drillTab: 'focus',
    evidence: [{ source: 'sfs', code: rec.code, params: rec.params }], effort: effortOf(rec.effort),
    moduleDelta: Number.isFinite(rec.deltaScore) ? { module: 'sfs', value: rec.deltaScore } : null,
  }));
  const links = sfs.linkSuggestions.map((link) => finish(scope, {
    type: 'internal-link', source: 'sfs', urls: [link.fromUrl, link.toUrl], ordered: true, drillTab: 'visualisations',
    evidence: [{ source: 'sfs', code: link.code, items: link.anchors }], effort: null, moduleDelta: null,
  }));
  return [...recs, ...links];
};

/** TAS actions carry deltaTas only while TAS itself is measured (a reference map exists). */
export const tasActions = (scope: ActionScope, tas: TopicalAuthorityReport | null | undefined): ExecutiveAction[] =>
  (tas?.recommendations ?? []).map((rec) => finish(scope, {
    type: `tas:${rec.code}`, source: 'tas', urls: [...rec.urls], drillTab: 'authority',
    evidence: [{ source: 'tas', code: rec.code, params: rec.params, items: rec.items }], effort: effortOf(rec.effort),
    moduleDelta: typeof tas?.tas === 'number' &&Number.isFinite(rec.deltaTas) ? { module: 'tas', value: rec.deltaTas } : null,
  }));

/** E-E-A-T findings have no declared simulation: their delta stays unavailable. Info findings are not actions. */
export const trustActions = (scope: ActionScope, trust: TrustReport | null | undefined): ExecutiveAction[] =>
  (trust?.findings ?? []).filter((finding) => finding.severity !== 'info').map((finding) => finish(scope, {
    type: `eetv:${finding.code}`, source: 'eetv', urls: [], drillTab: 'trust',
    evidence: [{ source: 'eetv', code: finding.code, params: { ...finding.params, severity: finding.severity } }], effort: null, moduleDelta: null,
  }));

/** Lexical link opportunities share the `internal-link` identity with SFS hub links, so duplicates merge. */
export const linkOpportunityActions = (scope: ActionScope, opportunities: readonly InternalLinkOpportunity[]): ExecutiveAction[] =>
  opportunities.map((item) => finish(scope, {
    type: 'internal-link', source: 'links', urls: [item.sourceUrl, item.targetUrl], ordered: true, drillTab: 'visualisations',
    evidence: [{ source: 'links', code: 'shared-terms', params: { weightedJaccard: item.weightedJaccard }, items: item.sharedTerms }], effort: null, moduleDelta: null,
  }));
