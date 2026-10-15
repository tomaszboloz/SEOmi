import type { SiteFocusReport } from '@/services/siteFocus';
import { phraseKey } from '@/services/siteFocus/terms';
import type { BenchmarkInsight, CompetitorGap, CompetitorResult, CompetitorSummary, RankingRow } from './types';

const LEADERS = 3;
const CORE_TERMS_KEPT = 20;
const MAX_GAPS = 30;
const MAX_FEED_TERMS = 20;
const DEFAULT_TARGET = 80;
const round1 = (value: number): number => Math.round(value * 10) / 10;
const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

export const offTopicPages = (report: SiteFocusReport): number =>
  report.pages.filter((page) => !page.skipped && page.status === 'off-topic').length;

export const summarize = (report: SiteFocusReport): CompetitorSummary => ({
  score: report.score,
  band: report.band,
  confidence: report.confidence,
  onTopicRatio: report.onTopicRatio,
  pageCount: report.pageCount,
  offTopicPages: offTopicPages(report),
  coreTerms: report.coreTopic.terms.map((term) => term.term).slice(0, CORE_TERMS_KEPT),
});

export const buildRanking = (own: SiteFocusReport, ownDomain: string, competitors: CompetitorResult[]): RankingRow[] => {
  const rows: Omit<RankingRow, 'rank'>[] = [
    { domain: ownDomain, isOwn: true, score: own.score, band: own.band, onTopicRatio: own.onTopicRatio, offTopicPages: offTopicPages(own), pageCount: own.pageCount },
    ...competitors.flatMap((item) => (item.summary ? [{ domain: item.domain, isOwn: false, score: item.summary.score, band: item.summary.band, onTopicRatio: item.summary.onTopicRatio, offTopicPages: item.summary.offTopicPages, pageCount: item.summary.pageCount }] : [])),
  ];
  rows.sort((a, b) => b.score - a.score || Number(b.isOwn) - Number(a.isOwn) || Number(a.domain > b.domain) - Number(a.domain < b.domain));
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
};

export const industryAverage = (competitors: CompetitorResult[]): number | null => {
  const scores = competitors.flatMap((item) => (item.summary ? [item.summary.score] : []));
  return scores.length ? round1(mean(scores)) : null;
};

export const targetFor = (competitors: CompetitorResult[], override?: number): number => {
  if (override !== undefined) return Math.max(0, Math.min(100, Math.round(override)));
  const leaders = leaderSummaries(competitors);
  return Math.min(100, Math.max(DEFAULT_TARGET, leaders.length ? Math.round(mean(leaders.map((item) => item.score))) : DEFAULT_TARGET));
};

const leaderSummaries = (competitors: CompetitorResult[]): CompetitorSummary[] =>
  competitors.flatMap((item) => (item.summary ? [item.summary] : [])).sort((a, b) => b.score - a.score).slice(0, LEADERS);

/** Keys of every term the own site demonstrably uses: clustered terms, core terms and per-page keywords. */
const ownKeySet = (own: SiteFocusReport): Set<string> => {
  const language = own.model.language;
  const keys = new Set(Object.keys(own.model.documentFrequency));
  const surfaces = [...own.coreTopic.terms.map((term) => term.term), ...own.pages.flatMap((page) => page.keywordsFound.map((keyword) => keyword.term))];
  surfaces.forEach((surface) => { const key = phraseKey(surface, language); if (key) keys.add(key); });
  return keys;
};

const keysOf = (terms: string[], language: string): Set<string> =>
  new Set(terms.flatMap((term) => phraseKey(term, language) ?? []));

export const buildInsights = (own: SiteFocusReport, competitors: CompetitorResult[]): BenchmarkInsight[] => {
  const average = industryAverage(competitors);
  if (average === null) return [];
  const leaders = leaderSummaries(competitors);
  const language = own.model.language;
  const ownKeys = ownKeySet(own);
  const leaderKeys = [...keysOf(leaders.flatMap((item) => item.coreTerms), language)];
  const covered = leaderKeys.filter((key) => ownKeys.has(key)).length;
  const insights: BenchmarkInsight[] = [
    { code: 'on-topic-share', params: { own: own.onTopicRatio, leaders: round1(mean(leaders.map((item) => item.onTopicRatio))), delta: round1(own.onTopicRatio - mean(leaders.map((item) => item.onTopicRatio))) } },
    { code: 'off-topic-pages', params: { own: offTopicPages(own), leaders: round1(mean(leaders.map((item) => item.offTopicPages))) } },
  ];
  if (leaderKeys.length) insights.push({ code: 'keyword-coverage', params: { pct: Math.round((covered / leaderKeys.length) * 100), covered, total: leaderKeys.length } });
  insights.push({ code: 'versus-average', params: { delta: round1(own.score - average), average } });
  return insights;
};

/** Competitor core terms the own site does not use, with coverage computed over crawled competitors. */
export const buildGaps = (own: SiteFocusReport, competitors: CompetitorResult[]): { gaps: CompetitorGap[]; competitorTerms: string[] } => {
  const ok = competitors.filter((item) => item.summary);
  if (!ok.length) return { gaps: [], competitorTerms: [] };
  const language = own.model.language;
  const ownKeys = ownKeySet(own);
  const found = new Map<string, { term: string; competitors: number }>();
  ok.forEach((item) => {
    const seen = new Set<string>();
    (item.summary as CompetitorSummary).coreTerms.forEach((term) => {
      const key = phraseKey(term, language);
      if (!key || ownKeys.has(key) || seen.has(key)) return;
      seen.add(key);
      const entry = found.get(key);
      if (entry) entry.competitors += 1;
      else found.set(key, { term, competitors: 1 });
    });
  });
  const gaps = [...found.values()]
    .map((entry) => ({ term: entry.term, competitors: entry.competitors, coveragePct: Math.round((entry.competitors / ok.length) * 100) }))
    .sort((a, b) => b.coveragePct - a.coveragePct || Number(a.term > b.term) - Number(a.term < b.term))
    .slice(0, MAX_GAPS);
  const minimum = Math.min(2, ok.length);
  return { gaps, competitorTerms: gaps.filter((gap) => gap.competitors >= minimum).slice(0, MAX_FEED_TERMS).map((gap) => gap.term) };
};
