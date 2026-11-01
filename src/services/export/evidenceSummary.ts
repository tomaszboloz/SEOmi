import type { CrawlRunRecord } from '@/types';
import { causalImpactFor } from '@/services/experiments/causalSeries';
import { causalPageFor } from '@/services/experiments/pageCausal';
import { loadPageSeries } from '@/services/experiments/pageSeries';
import { causalOutcomeFor } from '@/services/experiments/ga4Outcome';
import { loadGa4Outcomes, loadOutcomeChoice, type Outcome } from '@/services/experiments/ga4OutcomeStore';
import { listInterventions } from '@/services/experiments/registry';
import type { CausalEstimate } from '@/services/experiments/causalImpact';
import { readGscSnapshots } from '@/services/gscTracker/read';
import { evaluateDecay } from '@/services/semanticDecay/alert';
import { readSerpHistories } from '@/services/semanticDecay/snapshotStore';
import { recallRevenueImport } from '@/services/urlTelemetry';

export const EVIDENCE_ROWS = 10;

export interface EvidenceSummary {
  revenue?: { currency: string; attribution: string; period: string | null; pages: Array<{ page: string; revenue: number }> };
  experiments?: Array<{ target: string; date: string; method: 'structural'; outcome: Outcome; status: string; effect: number | null; lower: number | null; upper: number | null; probability: number | null }>;
  decay?: Array<{ query: string; verdict: string; samples: number; centroid_shift: number | null; new_entities: number; lost_entities: number }>;
}

const row = (target: string, date: string, outcome: Outcome, estimate: CausalEstimate) => ({
  target, date, method: 'structural' as const, outcome, status: estimate.status, effect: estimate.absolute?.estimate ?? null, lower: estimate.absolute?.lower ?? null,
  upper: estimate.absolute?.upper ?? null, probability: estimate.probability,
});

/** Saved GA4 revenue, experiment estimates and SERP drift for the project; absent blocks stay absent. The clock is injected. */
export const crawlEvidenceSummary = (run: CrawlRunRecord, now: Date = new Date(), rootUrl?: string): EvidenceSummary | undefined => {
  if (!run.projectId) return undefined;
  const summary: EvidenceSummary = {};
  const revenue = recallRevenueImport(run.projectId);
  if (revenue) {
    summary.revenue = { currency: revenue.currency, attribution: revenue.attribution, period: revenue.period ? `${revenue.period.start} – ${revenue.period.end}` : null,
      pages: [...revenue.rows].sort((a, b) => b.revenue - a.revenue).slice(0, EVIDENCE_ROWS).map((item) => ({ page: item.landingPage, revenue: item.revenue })) };
  }
  const snapshots = readGscSnapshots(run.projectId);
  const pages = loadPageSeries(run.projectId);
  const ga4 = loadGa4Outcomes(run.projectId);
  const outcome = loadOutcomeChoice(run.projectId);
  const experiments = listInterventions(run.projectId).slice(0, EVIDENCE_ROWS).flatMap((entry) => {
    const setup = outcome !== 'gsc-clicks' ? causalOutcomeFor(entry, ga4, outcome)
      : entry.url === 'site' ? causalImpactFor(entry, snapshots, rootUrl ?? run.startUrl) : causalPageFor(entry, pages);
    return setup.structural ? [row(entry.url, entry.date, outcome, setup.structural)] : [];
  });
  if (experiments.length) summary.experiments = experiments;
  const decay = Object.values(readSerpHistories(run.projectId)).filter((history) => history.snapshots.length).slice(0, EVIDENCE_ROWS).map((history) => {
    const evaluation = evaluateDecay(history.snapshots, history.lastAlertAt, now.toISOString());
    return { query: history.snapshots[0].query, verdict: evaluation.verdict, samples: history.snapshots.length, centroid_shift: evaluation.comparison?.centroidShift ?? null,
      new_entities: evaluation.comparison?.newEntities.length ?? 0, lost_entities: evaluation.comparison?.lostEntities.length ?? 0 };
  });
  if (decay.length) summary.decay = decay;
  return Object.keys(summary).length ? summary : undefined;
};
