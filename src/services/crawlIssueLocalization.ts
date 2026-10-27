import type { TFunction } from 'i18next';
import type { CrawledPageIssue } from '@/types';

interface CrawlIssueIdentity {
  messageKey: string;
  params?: Record<string, string | number>;
}

const inferCrawlIssueIdentity = (issue: CrawledPageIssue): CrawlIssueIdentity | null => {
  const message = issue.message;
  const matches = (
    pattern: RegExp,
    messageKey: string,
    params: Record<string, string | number> = {},
  ): CrawlIssueIdentity | null => {
    const result = message.match(pattern);
    return result ? { messageKey, params: { ...params, ...(result.groups ?? {}) } } : null;
  };

  if (issue.code) {
    const codeMap: Record<string, string> = {
      'crawl-missing-language': 'crawlIssues.missingLanguage',
      'crawl-nofollow-meta': 'crawlIssues.nofollowMeta',
      'crawl-nofollow-header': 'crawlIssues.nofollowHeader',
      'crawl-duplicate-content': 'crawlIssues.duplicateContent',
      'crawl-canonical-elsewhere': 'crawlIssues.canonicalElsewhere',
      'crawl-canonical-conflict': 'crawlIssues.canonicalConflict',
      'crawl-multiple-canonical': 'crawlIssues.multipleCanonical',
      'crawl-invalid-canonical': 'crawlIssues.invalidCanonical',
      'crawl-thin-content': 'crawlIssues.thinContent',
      'crawl-invalid-jsonld': 'crawlIssues.invalidJsonLd',
      'crawl-client-redirect': 'crawlIssues.clientRedirect',
      'crawl-invalid-pagination': 'crawlIssues.paginationInvalid',
    };
    const messageKey = codeMap[issue.code];
    if (messageKey) return { messageKey };
  }

  const titleLength = message.match(/^Title length is (?<count>\d+) characters; reference range is 30–60$/);
  if (titleLength?.groups?.count) {
    const count = Number(titleLength.groups.count);
    return {
      messageKey: count < 30
        ? 'auditIssues.messages.meta_title_short'
        : 'auditIssues.messages.meta_title_long',
      params: { count },
    };
  }
  const descriptionLength = message.match(/^Meta description length is (?<count>\d+) characters; reference range is 70–160$/);
  if (descriptionLength?.groups?.count) {
    const count = Number(descriptionLength.groups.count);
    return {
      messageKey: count < 70
        ? 'auditIssues.messages.meta_description_short'
        : 'auditIssues.messages.meta_description_long',
      params: { count },
    };
  }

  return matches(/^Missing <title> tag$/, 'auditIssues.messages.meta_title_missing')
    ?? matches(/^Multiple <title> tags found \((?<count>\d+)\)$/, 'crawlIssues.multipleTitle')
    ?? matches(/^Missing <h1> tag$/, 'auditIssues.messages.headings_h1_missing')
    ?? matches(/^Multiple <h1> tags found \((?<count>\d+)\)$/, 'auditIssues.messages.headings_h1_multiple')
    ?? matches(/^Heading hierarchy skips one or more levels$/, 'auditIssues.messages.headings_hierarchy_skip')
    ?? matches(/^Missing meta description tag$/, 'auditIssues.messages.meta_description_missing')
    ?? matches(/^Meta description is empty$/, 'crawlIssues.emptyDescription')
    ?? matches(/^Multiple meta description tags found \((?<count>\d+)\)$/, 'crawlIssues.multipleDescription')
    ?? matches(/^Missing canonical link$/, 'auditIssues.messages.meta_canonical_missing')
    ?? matches(/^Multiple canonical links found \((?<count>\d+)\)$/, 'crawlIssues.multipleCanonical')
    ?? matches(/^Canonical declaration has a missing, invalid, or non-HTTP URL$/, 'crawlIssues.invalidCanonical')
    ?? matches(/^Page declares noindex in meta robots$/, 'auditIssues.messages.meta_robots_noindex')
    ?? matches(/^Response declares noindex in X-Robots-Tag$/, 'auditIssues.messages.indexability_xrobots_noindex')
    ?? matches(/^Page declares nofollow in meta robots$/, 'crawlIssues.nofollowMeta')
    ?? matches(/^Response declares nofollow in X-Robots-Tag$/, 'crawlIssues.nofollowHeader')
    ?? matches(/^Canonical points to a different URL; the target was not validated in this verdict$/, 'crawlIssues.canonicalElsewhere')
    ?? matches(/^Canonical and noindex are both present; review the intended indexing signal$/, 'crawlIssues.canonicalConflict')
    ?? matches(/^Document has no html lang attribute$/, 'crawlIssues.missingLanguage')
    ?? matches(/^Duplicate normalized page content found in this crawl$/, 'crawlIssues.duplicateContent')
    ?? matches(/^Thin text content: (?<count>\d+) words$/, 'crawlIssues.thinContent')
    ?? matches(/^(?<count>\d+) invalid JSON-LD block\(s\)$/, 'crawlIssues.invalidJsonLd')
    ?? matches(/^Client-side refresh redirect detected \((?<count>\d+) declaration\(s\)\)$/, 'crawlIssues.clientRedirect')
    ?? matches(/^(?<count>\d+) pagination declaration\(s\) have a missing or invalid HTTP\(S\) target$/, 'crawlIssues.paginationInvalid')
    ?? matches(/^Browser rendering failed; the raw HTML response was analyzed instead: (?<reason>[\s\S]+)$/, 'crawlIssues.renderFallback')
    ?? matches(/^The page navigated to a different URL in the browser; the HTTP status and response headers describe the requested URL$/, 'crawlIssues.renderedSelfNavigation')
    ?? (message === 'Duplicate title found in this crawl'
      ? { messageKey: 'crawl.metadataFacets.duplicateTitleDescription' }
      : null)
    ?? (message === 'Duplicate meta description found in this crawl'
      ? { messageKey: 'crawl.metadataFacets.duplicateDescriptionDescription' }
      : null);
};

/**
 * Localizes crawler diagnostics only at render time. The raw backend message
 * remains untouched in the crawl snapshot and is still used for filtering and
 * exports, so localization never changes stored evidence.
 */
export const localizeCrawlIssue = (
  issue: CrawledPageIssue,
  t: TFunction,
): CrawledPageIssue & { displayMessage: string } => {
  const identity = inferCrawlIssueIdentity(issue);
  if (!identity) {
    return {
      ...issue,
      displayMessage: t('crawlIssues.technicalDetail', {
        detail: issue.message,
        defaultValue: issue.message,
      }),
    };
  }
  return {
    ...issue,
    displayMessage: t(identity.messageKey, {
      ...(identity.params ?? {}),
      defaultValue: issue.message,
    }),
  };
};

export const inferCrawlIssueMessageKey = (issue: CrawledPageIssue): string | null =>
  inferCrawlIssueIdentity(issue)?.messageKey ?? null;
