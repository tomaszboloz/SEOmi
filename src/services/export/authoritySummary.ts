import type { FocusPage } from '@/services/siteFocus';
import { buildAuthorityReport, buildGapBrief, type TopicalAuthorityReport } from '@/services/topicalAuthority';
import { readTaxonomy, readTopicalBenchmark } from '@/services/topicalAuthorityMonitoring';
import { buildRunReport, isCompletedRun, readManualTopic } from '@/services/siteFocusMonitoring';
import type { CodeParams } from '@/services/siteFocus';
import type { CrawlRunRecord } from '@/types';

export const AUTHORITY_PDF_GAPS = 20;
export const AUTHORITY_PDF_GROUPS = 15;

export interface AuthorityPdfSummary {
  tas: number | null;
  sfs: number;
  quadrant: string | null;
  multiplier: number;
  pillars: TopicalAuthorityReport['pillars'];
  cannibalization_index: number;
  warnings: string[];
  reference: { subtopics: number; pillars: number; competitors: number; source: string; built_at: string } | null;
  pillar_coverage: Array<{ label: string; coverage_pct: number; gaps: number; shallow: number }>;
  gaps: Array<{ label: string; level: string; weight: number }>;
  cannibalization: Array<{ canonical: string; pages: number; similarity: number }>;
  recommendations: Array<{ code: string; params: CodeParams; gain: number }>;
  benchmark: Array<{ domain: string; sfs: number; tas: number | null }>;
}

/** Compact, serializable digest of the Topical Authority report for the PDF renderer. */
export const summarizeAuthority = (report: TopicalAuthorityReport, benchmark: Array<{ domain: string; sfs: number; tas: number | null }> = []): AuthorityPdfSummary => ({
  tas: report.tas, sfs: report.sfs, quadrant: report.quadrant, multiplier: report.multiplier, pillars: report.pillars,
  cannibalization_index: report.cannibalizationIndex, warnings: report.warnings,
  reference: report.taxonomy ? { subtopics: report.taxonomy.subtopics.length, pillars: report.taxonomy.pillars.length, competitors: report.taxonomy.competitors.length, source: report.taxonomy.source, built_at: report.taxonomy.builtAt } : null,
  pillar_coverage: report.pillarCoverage.map((pillar) => ({ label: pillar.label, coverage_pct: pillar.coveragePct, gaps: pillar.gaps, shallow: pillar.shallow })),
  gaps: report.coverage.filter((row) => row.coverage === 0).sort((a, b) => b.importance - a.importance || (a.label < b.label ? -1 : 1)).slice(0, AUTHORITY_PDF_GAPS)
    .map((row) => ({ label: row.label, level: buildGapBrief(report, row).level, weight: Math.round(row.importance * 100) })),
  cannibalization: report.cannibalization.slice(0, AUTHORITY_PDF_GROUPS).map((group) => ({ canonical: group.canonical, pages: group.urls.length, similarity: group.similarity })),
  recommendations: report.recommendations.map((rec) => ({ code: rec.code, params: rec.params, gain: rec.deltaTas })),
  benchmark,
});

/** Authority digest of a completed run, using the project's cached reference map; undefined for unfinished runs. */
export const crawlAuthoritySummary = (run: CrawlRunRecord): AuthorityPdfSummary | undefined => {
  if (!isCompletedRun(run)) return undefined;
  const sfs = buildRunReport(run, readManualTopic(run.projectId));
  const report = buildAuthorityReport(run.result.pages as FocusPage[], run.startUrl, sfs, { taxonomy: readTaxonomy(run.projectId), now: sfs.generatedAt });
  const rows = readTopicalBenchmark(run.projectId)?.rows.map((row) => ({ domain: row.domain, sfs: row.sfs, tas: row.tas })) ?? [];
  return summarizeAuthority(report, rows);
};
