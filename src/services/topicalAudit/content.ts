import type { CrawledPageSummary } from '@/types';
import type { SemanticAuditFinding } from './types';
import i18n from '@/i18n';
import { auditPageIndex } from './mapping';
import { urlKey, addFinding, semanticText } from './evidence';

export const auditContentLinks = (pages: CrawledPageSummary[], inputTruncated: boolean, findings: SemanticAuditFinding[]) => {
  // Deliberately measure contextual links from extracted main content only. This
  // complements (and does not replace) the broader crawler orphan-page report,
  // where navigation/footer links remain part of the site's discovery graph.
  const hasContentLinkSnapshot = !inputTruncated && pages.every((page) => Array.isArray(page.semantic_links));
  const contentIncomingSources = new Map<string, Set<string>>();
  if (hasContentLinkSnapshot) {
    const pageByContentUrl = auditPageIndex(pages);
    for (const source of pages) {
      // hasContentLinkSnapshot guarantees every selected page has this array.
      for (const link of source.semantic_links!) {
        if (!link.is_internal) continue;
        const target = pageByContentUrl.get(urlKey(link.target_url, source.final_url || source.url));
        if (!target || target === source) continue;
        const key = urlKey(target.url);
        const sources = contentIncomingSources.get(key) ?? new Set<string>();
        sources.add(urlKey(source.url));
        contentIncomingSources.set(key, sources);
      }
    }
  }
  let contentOrphanPages: number | null = hasContentLinkSnapshot ? 0 : null;
  if (hasContentLinkSnapshot) for (const page of pages) {
    // The crawl seed is a root by definition, not an orphan merely because it
    // has no incoming contextual link. Old snapshots without semantic_links are unknown.
    if (page.depth === 0 || (contentIncomingSources.get(urlKey(page.url))?.size ?? 0) > 0) continue;
    contentOrphanPages! += 1;
    const incomingCount = contentIncomingSources.get(urlKey(page.url))?.size ?? 0;
    addFinding(findings, {
      id: `content-orphan-${urlKey(page.url)}`.slice(0, 240), code: 'content-orphan-page', severity: 'review',
      provenance: ['measured'], title: semanticText('orphanTitle'),
      detail: semanticText('orphanDetail'),
      urls: [page.url], evidence: [semanticText('incoming', { count: incomingCount }), semanticText('depth', { depth: Number.isFinite(page.depth) ? page.depth : i18n.t('auditProblems.unknown') })], confidence: 'limited',
    });
  }

  return contentOrphanPages;
};
