import type { CrawledPageSummary, SiteCrawlResult } from '@/types';
import i18n from '@/i18n';
import { isSemanticTopicalStatus, semanticPageTermEntries } from '@/services/semanticText';

export type CrawlerReadinessStatus = 'pass' | 'warning' | 'error' | 'unknown';
export type TranslationParams = Record<string, string | number>;

export interface CrawlerReadinessCheck {
  id: string;
  labelKey: string;
  status: CrawlerReadinessStatus;
  affectedPages: number;
  totalPages: number;
  evidenceKey: string;
  evidenceParams: TranslationParams;
  evidence: string;
  recommendationKey?: string;
}

export interface CrawlerReadinessReport {
  score: number | null;
  checks: CrawlerReadinessCheck[];
  knownChecks: number;
  totalPages: number;
  limitationKeys: string[];
  limitations: string[];
}

const lower = (value: string | undefined | null): string => (value || '').toLocaleLowerCase();
const countPages = (pages: CrawledPageSummary[], predicate: (page: CrawledPageSummary) => boolean): number => pages.reduce((count, page) => count + (predicate(page) ? 1 : 0), 0);

const pageCheck = (
  id: string,
  labelKey: string,
  pages: CrawledPageSummary[],
  bad: number,
  warning: number,
  evidenceKey: string,
  evidenceParams: TranslationParams,
  recommendationKey?: string,
): CrawlerReadinessCheck => ({
  id, labelKey, status: bad > 0 ? 'error' : warning > 0 ? 'warning' : 'pass',
  affectedPages: bad || warning, totalPages: pages.length, evidenceKey, evidenceParams, evidence: i18n.t(`crawlerReadiness.checks.${evidenceKey}`, evidenceParams), recommendationKey,
});

const unknownCheck = (
  id: string,
  labelKey: string,
  pages: CrawledPageSummary[],
  evidenceKey: string,
  evidenceParams: TranslationParams,
  recommendationKey?: string,
): CrawlerReadinessCheck => ({
  id, labelKey, status: 'unknown', affectedPages: 0, totalPages: pages.length,
  evidenceKey, evidenceParams, evidence: i18n.t(`crawlerReadiness.checks.${evidenceKey}`, evidenceParams), recommendationKey,
});

export const buildCrawlerReadiness = (result: SiteCrawlResult): CrawlerReadinessReport => {
  const pages = result.pages || [];
  const totalPages = pages.length;
  if (totalPages === 0) return { score: null, checks: [], knownChecks: 0, totalPages: 0, limitationKeys: ['emptyRun'], limitations: [i18n.t('crawlerReadiness.limitations.emptyRun')] };

  const httpErrors = countPages(pages, (page) => Boolean(page.request_error_kind) || !page.http_status || page.http_status >= 400);
  const redirects = countPages(pages, (page) => page.http_status >= 300 && page.http_status < 400);
  const indexabilityErrors = countPages(pages, (page) => /blocked|noindex|not index|non-index|disallow/.test(lower(page.indexability_status)));
  const indexabilityUnknown = countPages(pages, (page) => { const value = lower(page.indexability_status); return !value || !/eligible|indexable|blocked|noindex|not index|non-index|disallow/.test(value); });
  const missingTitle = countPages(pages, (page) => !page.title?.trim());
  const missingDescription = countPages(pages, (page) => !page.meta_description?.trim());
  const missingCanonical = countPages(pages, (page) => !page.canonical?.trim());
  const metadataWarningPages = countPages(pages, (page) => Boolean(page.title?.trim()) && (!page.meta_description?.trim() || !page.canonical?.trim()));
  const contentMissing = countPages(pages, (page) => page.word_count <= 0);
  const contentTruncated = countPages(pages, (page) => page.body_truncated);
  const missingLanguage = countPages(pages, (page) => !page.document_language?.trim());
  // The crawler extracts no terms from redirects and error pages; http-response reports those.
  const termPages = countPages(pages, (page) => isSemanticTopicalStatus(page.http_status));
  const missingTerms = countPages(pages, (page) => isSemanticTopicalStatus(page.http_status) && semanticPageTermEntries(page).length === 0);
  const schemaErrors = countPages(pages, (page) => page.schema_syntax_errors > 0 || Boolean(page.schema_validation_findings?.some((finding) => finding.finding.severity === 'error')));
  const schemaObserved = countPages(pages, (page) => page.schema_types.length > 0);

  const checks: CrawlerReadinessCheck[] = [
    pageCheck('http-response', 'httpResponse.label', pages, httpErrors, redirects, 'httpResponse.evidence', { healthy: totalPages - httpErrors, total: totalPages, redirects }, httpErrors ? 'httpResponse.recommendation' : undefined),
    { id: 'indexability', labelKey: 'indexability.label', status: indexabilityUnknown === totalPages ? 'unknown' : indexabilityErrors > 0 ? 'error' : indexabilityUnknown > 0 ? 'warning' : 'pass', affectedPages: indexabilityErrors || indexabilityUnknown, totalPages, evidenceKey: 'indexability.evidence', evidenceParams: { clear: totalPages - indexabilityErrors - indexabilityUnknown, blocked: indexabilityErrors, unknown: indexabilityUnknown }, evidence: i18n.t('crawlerReadiness.checks.indexability.evidence', { clear: totalPages - indexabilityErrors - indexabilityUnknown, blocked: indexabilityErrors, unknown: indexabilityUnknown }), recommendationKey: indexabilityErrors || indexabilityUnknown ? 'indexability.recommendation' : undefined },
    { id: 'robots', labelKey: 'robots.label', status: result.robots_blocked_count > 0 ? 'warning' : /unavailable|disabled|error|failed|returned http|could not be read/.test(lower(result.robots_txt_status)) ? 'unknown' : 'pass', affectedPages: result.robots_blocked_count, totalPages, evidenceKey: 'robots.evidence', evidenceParams: { status: result.robots_txt_status, blocked: result.robots_blocked_count }, evidence: i18n.t('crawlerReadiness.checks.robots.evidence', { status: result.robots_txt_status, blocked: result.robots_blocked_count }), recommendationKey: result.robots_blocked_count > 0 ? 'robots.recommendation' : undefined },
    pageCheck('content', 'content.label', pages, contentMissing, contentTruncated, 'content.evidence', { available: totalPages - contentMissing, truncated: contentTruncated }, contentMissing || contentTruncated ? 'content.recommendation' : undefined),
    pageCheck('metadata', 'metadata.label', pages, missingTitle, metadataWarningPages, 'metadata.evidence', { titles: totalPages - missingTitle, descriptions: totalPages - missingDescription, canonicals: totalPages - missingCanonical }, missingTitle || missingDescription || missingCanonical ? 'metadata.recommendation' : undefined),
    pageCheck('language-accessibility', 'languageAccessibility.label', pages, 0, missingLanguage, 'languageAccessibility.evidence', { declared: totalPages - missingLanguage, missing: missingLanguage }, missingLanguage ? 'languageAccessibility.recommendation' : undefined),
    { id: 'structured-data', labelKey: 'structuredData.label', status: schemaErrors > 0 ? 'error' : schemaObserved > 0 ? 'pass' : 'unknown', affectedPages: schemaErrors, totalPages, evidenceKey: 'structuredData.evidence', evidenceParams: { observed: schemaObserved, errors: schemaErrors }, evidence: i18n.t('crawlerReadiness.checks.structuredData.evidence', { observed: schemaObserved, errors: schemaErrors }), recommendationKey: schemaErrors ? 'structuredData.recommendation' : undefined },
    { id: 'content-semantics', labelKey: 'contentSemantics.label', status: missingTerms === termPages ? 'unknown' : missingTerms > 0 ? 'warning' : 'pass', affectedPages: missingTerms, totalPages, evidenceKey: 'contentSemantics.evidence', evidenceParams: { withTerms: termPages - missingTerms, withoutTerms: missingTerms }, evidence: i18n.t('crawlerReadiness.checks.contentSemantics.evidence', { withTerms: termPages - missingTerms, withoutTerms: missingTerms }), recommendationKey: missingTerms ? 'contentSemantics.recommendation' : undefined },
    result.crawl_mode === 'browser-rendered' ? { id: 'rendered-dom', labelKey: 'renderedDom.label', status: 'pass' as const, affectedPages: 0, totalPages, evidenceKey: 'renderedDom.renderedEvidence', evidenceParams: {}, evidence: i18n.t('crawlerReadiness.checks.renderedDom.renderedEvidence'), recommendationKey: 'renderedDom.renderedRecommendation' } : unknownCheck('rendered-dom', 'renderedDom.label', pages, 'renderedDom.httpEvidence', {}, 'renderedDom.httpRecommendation'),
  ];

  const knownChecks = checks.filter((check) => check.status !== 'unknown');
  const score = knownChecks.length === 0 ? null : Math.round(knownChecks.reduce((sum, check) => sum + (check.status === 'pass' ? 100 : check.status === 'warning' ? 55 : 0), 0) / knownChecks.length);
  return { score, checks, knownChecks: knownChecks.length, totalPages, limitationKeys: ['localScore', 'robotsScope', 'httpSnapshot'], limitations: ['localScore', 'robotsScope', 'httpSnapshot'].map((key) => i18n.t(`crawlerReadiness.limitations.${key}`)) };
};
