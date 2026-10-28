import { buildRunReport, isCompletedRun } from '@/services/siteFocusMonitoring/analysis';
import { readManualTopic } from '@/services/siteFocusMonitoring/topic';
import type { CrawlRunRecord } from '@/types';
import { buildTrustReport } from './build';
import type { CodeParams } from '@/services/siteFocus';
import type { TransparencyKind, TrustReport } from './types';

/** Authors listed in the PDF; the full entity list stays in the app. */
export const TRUST_PDF_AUTHORS = 15;

export interface TrustPdfSummary {
  score: number | null;
  level: string | null;
  layers: { schema_graph: number | null; same_as: number | null; author_alignment: number | null; citation_quality: number | null; transparency: number | null };
  profile_version: number;
  profile_id: string;
  coverage: Record<string, { observed: number; declared: number; verified: number; unknown: number }>;
  ymyl: string | null;
  ymyl_unattributed_pct: number | null;
  article_count: number;
  page_count: number;
  organization: { present: boolean; has_id: boolean; same_as: number };
  counts: { authors: number; authors_with_same_as: number; trusted_pages: number; analyzed_pages: number; dead_links: number; dated_articles: number };
  authors: Array<{ name: string; articles: number; same_as: number; alignment: number | null; generic: boolean; profile_status: string }>;
  claims: Array<{ claim: string; relation: string; evidence: string; source_checked: boolean }>;
  pages: Record<TransparencyKind, string | null>;
  findings: Array<{ code: string; params: CodeParams; severity: string }>;
}

/** Compact, serializable digest of the trust report for the PDF renderer. */
export const summarizeTrust = (report: TrustReport): TrustPdfSummary => ({
  score: report.score,
  level: report.level,
  layers: {
    schema_graph: report.layers.schemaGraph ?? null,
    same_as: report.layers.sameAs ?? null,
    author_alignment: report.layers.authorAlignment ?? null,
    citation_quality: report.layers.citationQuality ?? null,
    transparency: report.layers.transparency ?? null,
  },
  profile_version: report.profileVersion,
  profile_id: report.profileId,
  coverage: report.coverage,
  ymyl: report.ymyl ?? null,
  ymyl_unattributed_pct: report.ymylUnattributedPct ?? null,
  article_count: report.articleCount,
  page_count: report.pageCount,
  organization: { present: report.schema.organization.present, has_id: report.schema.organization.hasId, same_as: report.schema.organization.sameAs.length },
  counts: {
    authors: report.schema.personCount, authors_with_same_as: report.schema.personsWithSameAs, trusted_pages: report.citations.pagesWithTrusted,
    analyzed_pages: report.citations.pagesAnalyzed, dead_links: report.citations.deadLinks.length, dated_articles: report.transparency.datedArticles,
  },
  authors: report.authors.slice(0, TRUST_PDF_AUTHORS).map((author) => ({
    name: author.name, articles: author.articleUrls.length, same_as: author.sameAs.length, alignment: author.alignmentPct ?? null, generic: author.generic,
    profile_status: author.profiles.length ? author.profiles.map((profile) => `${profile.kind}:${profile.status}`).join(', ') : 'unavailable',
  })),
  claims: (report.citations.claimEvidence ?? []).slice(0, 20).map((claim) => ({
    claim: claim.claim, relation: claim.relation, evidence: claim.evidence, source_checked: claim.sourceChecked,
  })),
  pages: {
    editorial: report.transparency.found.editorial ?? null, about: report.transparency.found.about ?? null,
    contact: report.transparency.found.contact ?? null, registry: report.transparency.found.registry ?? null,
  },
  findings: report.findings.map((finding) => ({ code: finding.code, params: finding.params, severity: finding.severity })),
});

/** Summary for a completed run, honouring the project's manual core topic; undefined when nothing can be assessed. */
export const crawlTrustSummary = (run: CrawlRunRecord): TrustPdfSummary | undefined => {
  if (!isCompletedRun(run)) return undefined;
  const focus = buildRunReport(run, readManualTopic(run.projectId));
  return summarizeTrust(buildTrustReport(run.result.pages, focus));
};
