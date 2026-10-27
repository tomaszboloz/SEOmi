import type { CrawlRunRecord } from '@/types';
import { buildAioReport } from './report';
import type { AioIssue, AioReport } from './types';

export const AIO_PDF_PAGES = 25;
export const AIO_PDF_PASSAGES = 12;
const EXCERPT_CHARS = 220;

export interface AioPdfSummary {
  score: number | null;
  band: string;
  self_containment: number | null;
  spo_density: number | null;
  extractability: number | null;
  availability: 'complete' | 'partial' | 'unavailable';
  scored: number;
  skipped: number;
  basic_rule_languages: string[];
  pages: Array<{ url: string; score: number; self_containment: number; spo_density: number; extractability: number; chunks: number; triples: number; language: string }>;
  passages: Array<{ url: string; heading: string; score: number; excerpt: string; issues: AioIssue[] }>;
  profile: { id: string; algorithm_version: string; config_hash: string; language: string; market: string };
  historical_profile?: AioPdfSummary['profile'];
  profile_status: 'persisted' | 'legacy-unversioned' | 'mismatch';
  unknown_reasons: string[];
}

/** Compact, serializable digest of the AI-readiness report for the PDF renderer: weakest pages and passages only. */
type SummaryProfile = AioPdfSummary['profile'];
const profileIdentity = (profile: SummaryProfile): string => [profile.id, profile.algorithm_version, profile.config_hash, profile.language, profile.market].join('|');

export const summarizeAio = (report: AioReport, profile: SummaryProfile = {
  id: report.profile.id, algorithm_version: report.profile.algorithmVersion, config_hash: report.profile.configHash, language: report.profile.language, market: report.profile.market,
}, profileStatus: AioPdfSummary['profile_status'] = 'persisted'): AioPdfSummary => ({
  score: report.score,
  band: report.band,
  self_containment: report.selfContainment,
  spo_density: report.spoDensity,
  extractability: report.extractability,
  scored: report.scoredCount,
  skipped: report.skippedCount,
  basic_rule_languages: report.basicRuleLanguages,
  pages: report.pages
    .filter((page) => !page.skipped)
    .sort((a, b) => a.score - b.score || (a.url < b.url ? -1 : 1))
    .slice(0, AIO_PDF_PAGES)
    .map((page) => ({ url: page.url, score: page.score, self_containment: page.selfContainment, spo_density: page.spoDensity, extractability: page.extractability, chunks: page.chunkCount, triples: page.tripleCount, language: page.language })),
  passages: report.weakPassages.slice(0, AIO_PDF_PASSAGES).map((chunk) => ({
    url: chunk.url,
    heading: chunk.heading,
    score: chunk.score,
    excerpt: chunk.text.length > EXCERPT_CHARS ? `${chunk.text.slice(0, EXCERPT_CHARS)}…` : chunk.text,
    issues: chunk.issues,
  })),
  profile,
  profile_status: profileStatus,
  availability: report.availability === 'complete' ? 'complete' : report.scoredCount ? 'partial' : 'unavailable',
  unknown_reasons: report.unknownReasons,
});

const skipReasons = (report: AioReport): string[] => report.pages.flatMap((page) => page.skipped ? [page.skipped] : []);

/** Summary for a finished run; old non-empty runs remain explicit unavailable summaries. */
export const crawlAioSummary = (run: CrawlRunRecord): AioPdfSummary | undefined => {
  const pages = run.result?.pages ?? [];
  if (run.result?.cancelled || run.result?.timed_out || !pages.length) return undefined;
  const report = buildAioReport(pages);
  const reasons = [...new Set([...report.unknownReasons, ...skipReasons(report)])];
  const stored = run.result.aio_profile;
  const storedProfile: SummaryProfile | undefined = stored && {
    id: stored.id, algorithm_version: stored.algorithmVersion, config_hash: stored.configHash, language: stored.language, market: stored.market,
  };
  const currentProfile: SummaryProfile = {
    id: report.profile.id, algorithm_version: report.profile.algorithmVersion, config_hash: report.profile.configHash, language: report.profile.language, market: report.profile.market,
  };
  const profileStatus = storedProfile
    ? (profileIdentity(storedProfile) === profileIdentity(currentProfile) ? 'persisted' : 'mismatch')
    : 'legacy-unversioned';
  const summary = summarizeAio(report, currentProfile, profileStatus);
  if (!report.scoredCount) return {
    ...summary,
    score: null,
    band: 'unavailable',
    self_containment: null,
    spo_density: null,
    extractability: null,
    availability: 'unavailable',
    unknown_reasons: reasons.length ? reasons : ['no-sections'],
    ...(storedProfile ? { historical_profile: storedProfile } : {}),
  };
  return {
    ...summary,
    availability: report.availability === 'complete' ? 'complete' : 'partial',
    unknown_reasons: reasons,
    ...(storedProfile ? { historical_profile: storedProfile } : {}),
  };
};
