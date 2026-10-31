import type { TrustReport } from '@/services/eeatTrust';
import type { HssReport } from '@/services/hss';
import type { InternalLinkOpportunity } from '@/services/internalLinkOpportunities';
import type { RemovalGuard } from '@/services/recommendationBus/guard';
import type { SiteFocusReport } from '@/services/siteFocus';
import type { TopicalAuthorityReport } from '@/services/topicalAuthority';
import { arbitrateActions } from './arbitrate';
import { dedupeActions } from './identity';
import { hssDeltaFor, rankActions } from './rank';
import { linkOpportunityActions, sfsActions, tasActions, trustActions, type ActionScope } from './sources';
import type { ExecutiveAction } from './types';

export interface ActionFeedInput extends ActionScope {
  hss: HssReport;
  sfs?: SiteFocusReport | null;
  tas?: TopicalAuthorityReport | null;
  trust?: TrustReport | null;
  linkOpportunities?: readonly InternalLinkOpportunity[];
  guard?: Partial<RemovalGuard>;
}

/**
 * Executive Action Feed (#89): one stream from the real module outputs. Pure and read-only: it never edits
 * the crawl, the module reports or a CMS. Deltas are SEOmi heuristics, not traffic, citation or ROI promises.
 */
export const buildActionFeed = (input: ActionFeedInput): ExecutiveAction[] => {
  const scope = { projectId: input.projectId, runId: input.runId };
  const drafted = dedupeActions([
    ...sfsActions(scope, input.sfs),
    ...tasActions(scope, input.tas),
    ...trustActions(scope, input.trust),
    ...linkOpportunityActions(scope, input.linkOpportunities ?? []),
  ]);
  const arbitrated = arbitrateActions(drafted, input.guard);
  return rankActions(arbitrated.map((action) => ({ ...action, hssDelta: hssDeltaFor(action, input.hss) })));
};

export { actionId, dedupeActions } from './identity';
export { arbitrateActions } from './arbitrate';
export { actionRatio, hssDeltaFor, rankActions } from './rank';
export type { ActionConflict, ActionConflictKind, ActionDrillTab, ActionEffort, ActionEvidence, ActionSource, ExecutiveAction, ModuleDelta } from './types';
export { ACTION_DECISIONS, actionSubject, currentDecisions, decisionHistory, DECISION_HISTORY_LIMIT, readDecisionLog, recordDecision, type ActionDecision, type ActionDecisionKind } from './decisions';
