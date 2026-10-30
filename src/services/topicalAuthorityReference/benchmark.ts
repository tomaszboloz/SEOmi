import { buildSiteFocusReport } from '@/services/siteFocus';
import { buildAuthorityReport, type CompetitorPages, type ReferenceTaxonomy, type TopicalAuthorityReport } from '@/services/topicalAuthority';
import type { AuthorityInsight, BenchmarkRow, PillarComparison, TopicalBenchmark } from './types';

export const BENCHMARK_COMPETITORS = 3;
const TRAILING_SHOWN = 2;

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Topical Gap Matrix: the strongest SERP competitors are scored with the very same engine and reference map,
 * so the pillar-by-pillar comparison is like for like.
 */
export const buildTopicalBenchmark = (
  own: TopicalAuthorityReport, ownDomain: string, competitors: CompetitorPages[], taxonomy: ReferenceTaxonomy, now: string, attempted?: string[],
): TopicalBenchmark | null => {
  const scored = competitors.filter((item) => item.pages.length).slice(0, BENCHMARK_COMPETITORS).map((item) => {
    const start = `https://${item.domain}/`;
    const sfs = buildSiteFocusReport(item.pages, start, { language: taxonomy.language || undefined, now });
    return { domain: item.domain, report: buildAuthorityReport(item.pages, start, sfs, { taxonomy, now }) };
  });
  if (!scored.length) return null;
  const rows: BenchmarkRow[] = [
    { domain: ownDomain, sfs: own.sfs, tas: own.tas, quadrant: own.quadrant, isOwn: true },
    ...scored.map(({ domain, report }): BenchmarkRow => ({ domain, sfs: report.sfs, tas: report.tas, quadrant: report.quadrant, isOwn: false })),
  ].sort((a, b) => (b.tas ?? -1) - (a.tas ?? -1) || Number(b.isOwn) - Number(a.isOwn) || (a.domain < b.domain ? -1 : 1));
  const pillars: PillarComparison[] = own.pillarCoverage.map((pillar) => ({
    id: pillar.id, label: pillar.label, own: pillar.coveragePct,
    competitors: Object.fromEntries(scored.map(({ domain, report }) => [domain, report.pillarCoverage.find((item) => item.id === pillar.id)?.coveragePct ?? 0])),
  }));
  const margin = (pillar: PillarComparison): number => pillar.own - Math.max(...Object.values(pillar.competitors));
  const lead = [...pillars].sort((a, b) => margin(b) - margin(a))[0];
  const trailing = pillars.filter((pillar) => margin(pillar) < 0).sort((a, b) => margin(a) - margin(b)).slice(0, TRAILING_SHOWN);
  const insights: AuthorityInsight[] = [{ code: 'rank', params: { rank: rows.findIndex((row) => row.isOwn) + 1, total: rows.length } }];
  if (lead && margin(lead) > 0) insights.push({ code: 'lead-pillar', params: { pillar: lead.label, own: round1(lead.own), best: round1(Math.max(...Object.values(lead.competitors))) } });
  if (trailing.length) insights.push({ code: 'trailing-pillars', params: { pillars: trailing.map((pillar) => pillar.label).join(', ') } });
  const scoredDomains = new Set(scored.map(({ domain }) => domain));
  // SERP order: the competitors tried before the matrix filled up; the ones that gave no pages are reported, not scored 0.
  const tried: string[] = [];
  for (const domain of new Set(attempted ?? [])) {
    if (tried.filter((item) => scoredDomains.has(item)).length >= scored.length) break;
    tried.push(domain);
  }
  const sample = attempted ? { attempted: tried.length, scored: scored.length, failed: tried.filter((domain) => !scoredDomains.has(domain)).sort() } : undefined;
  return { builtAt: now, source: taxonomy.source, rows, ownRank: rows.findIndex((row) => row.isOwn) + 1, pillars, insights, ...(sample ? { sample } : {}) };
};
