import type { Clock } from '@/services/siteFocusMonitoring';
import { buildProjectRunReport } from '@/services/siteFocusMonitoring/projectReport';
import { isCompletedRun } from '@/services/siteFocusMonitoring/analysis';
import type { MonitoringDelivery } from '@/services/monitoringAlerts';
import type { FocusPage } from '@/services/siteFocus';
import { buildAuthorityReport, type ReferenceTaxonomy } from '@/services/topicalAuthority';
import { buildTopicalBenchmark, referenceMarket, withSerpEvidence, type ReferenceInput, type ReferenceOutcome, type TopicalBenchmark } from '@/services/topicalAuthorityReference';
import { recordReferenceSnapshot } from '@/services/semanticDecay/recordReferenceSnapshot';
import type { CrawlRunRecord } from '@/types';
import { validAuthorityProject } from './keys';
import { recordAuthority } from './analysis';
import { afterAttempt, readRefreshState, refreshDecision, writeRefreshState, type RefreshSkip } from './refreshPolicy';
import { readTaxonomy, taxonomyMatchesCore, writeTaxonomy } from './taxonomyStore';

export interface ScheduledAuthorityDeps {
  clock?: Clock;
  delivery?: MonitoringDelivery;
  /** Fetches a fresh reference map; absent means no SERP source is wired, so nothing is refreshed. */
  refresh?: (input: ReferenceInput) => Promise<ReferenceOutcome>;
  market?: () => { country: string; language: string };
}
export type ScheduledAuthorityRefresh = 'ran' | 'failed' | 'no-source' | RefreshSkip;
export interface ScheduledAuthorityResult { recorded: boolean; refresh: ScheduledAuthorityRefresh; skipped?: 'invalid' | 'error' }

interface Refreshed { taxonomy: ReferenceTaxonomy; benchmark: TopicalBenchmark | null }

const domainOf = (startUrl: string): string => { try { return new URL(startUrl).hostname.replace(/^www\./, ''); } catch { return startUrl; } };

/** One policy-gated SERP refresh. Every attempt, success or failure, is booked against the cooldown and budget. */
const refreshMap = async (projectId: string, run: CrawlRunRecord, sfs: ReturnType<typeof buildProjectRunReport>, deps: ScheduledAuthorityDeps, now: number): Promise<{ status: ScheduledAuthorityRefresh; refreshed?: Refreshed }> => {
  const state = readRefreshState(projectId);
  const decision = refreshDecision(state, now);
  if (!decision.run) return { status: decision.reason };
  if (!deps.refresh) return { status: 'no-source' };
  const outcome = await deps.refresh({ report: sfs, startUrl: run.startUrl }).catch((): ReferenceOutcome => ({ status: 'cancelled' }));
  writeRefreshState(projectId, afterAttempt(state, now, outcome.status === 'ok'));
  if (outcome.status !== 'ok') return { status: 'failed' };
  const market = (deps.market ?? referenceMarket)();
  const stamped: ReferenceTaxonomy = { ...outcome.taxonomy, market };
  writeTaxonomy(projectId, stamped);
  recordReferenceSnapshot(projectId, stamped, outcome.serp, market);
  const own = buildAuthorityReport(run.result.pages as FocusPage[], run.startUrl, sfs, { taxonomy: stamped, now: sfs.generatedAt });
  const benchmark = withSerpEvidence(buildTopicalBenchmark(own, domainOf(run.startUrl), outcome.competitors, stamped, sfs.generatedAt, outcome.attempted), outcome.serp);
  return { status: 'ran', refreshed: { taxonomy: stamped, benchmark } };
};

const runOnce = async (projectId: string, run: CrawlRunRecord, deps: ScheduledAuthorityDeps): Promise<ScheduledAuthorityResult> => {
  if (!validAuthorityProject(projectId) || !isCompletedRun(run)) return { recorded: false, refresh: 'disabled', skipped: 'invalid' };
  const clock = deps.clock ?? Date.now;
  const now = clock();
  const sfs = buildProjectRunReport(run, projectId, new Date(now).toISOString());
  const { status, refreshed } = await refreshMap(projectId, run, sfs, deps, now);
  const cached = refreshed?.taxonomy ?? readTaxonomy(projectId, now);
  const taxonomy = cached && taxonomyMatchesCore(cached, { coreLabel: sfs.coreTopic.label, language: sfs.model.language, market: (deps.market ?? referenceMarket)() }) ? cached : null;
  const report = buildAuthorityReport(run.result.pages as FocusPage[], run.startUrl, sfs, { taxonomy, now: sfs.generatedAt });
  // Same run id scheme as the Authority tab, so opening the tab later never records or notifies a second time.
  const runId = taxonomy ? `${run.id}:${taxonomy.builtAt}` : run.id;
  const saved = recordAuthority(projectId, report, runId, run.result.pages.map((page) => page.url), { clock, delivery: deps.delivery, benchmark: refreshed?.benchmark ?? null });
  return { recorded: saved.saved, refresh: status };
};

/** After a completed crawl (including native scheduled ones): record TAS, raise decay/competitor alerts, refresh the map when allowed. Never rejects. */
export const runScheduledAuthority = (projectId: string, run: CrawlRunRecord, deps: ScheduledAuthorityDeps = {}): Promise<ScheduledAuthorityResult> =>
  runOnce(projectId, run, deps).catch(() => ({ recorded: false, refresh: 'failed' as const, skipped: 'error' as const }));
