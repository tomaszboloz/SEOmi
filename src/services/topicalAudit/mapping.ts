import type { CrawledPageSummary } from '@/types';
import type { TopicalMapDocument, TopicalNode } from '@/services/topicalMap';
import type { SemanticAuditFinding } from './types';
import { pageOwnersByUrl } from '@/services/semanticGraph/urls';
import { urlKey, addFinding, semanticText } from './evidence';

export const auditPageIndex = (pages: CrawledPageSummary[]): Map<string, CrawledPageSummary> =>
  new Map([...pageOwnersByUrl(pages)].map(([url, id]) => [url, pages[Number(id.slice(5))]]));

export const mapTopicalAssignments = (
  document: TopicalMapDocument, pages: CrawledPageSummary[], findings: SemanticAuditFinding[],
) => {
  const pageByUrl = auditPageIndex(pages);
  const pagesByTopic = new Map<string, CrawledPageSummary[]>();
  const topicsByPage = new Map<string, TopicalNode[]>();
  for (const node of document.nodes) {
    const matchedPages = new Map<string, CrawledPageSummary>();
    const stale = node.sourceUrls.filter((url) => !pageByUrl.has(urlKey(url)));
    node.sourceUrls.forEach((url) => {
      const page = pageByUrl.get(urlKey(url));
      if (page) matchedPages.set(page.url, page);
    });
    pagesByTopic.set(node.id, [...matchedPages.values()]);
    if (!matchedPages.size) addFinding(findings, {
      id: `topic-unmapped-${node.id}`, code: 'unmapped-topic', severity: 'review', provenance: ['asserted', 'measured'],
      title: semanticText('topicUnmappedTitle', { topic: node.title }),
      detail: semanticText('topicUnmappedDetail'),
      urls: [], topicId: node.id, evidence: [semanticText('lifecycle', { value: node.lifecycle }), semanticText('assignedUrls', { count: node.sourceUrls.length })], confidence: 'limited',
    });
    if (stale.length) addFinding(findings, {
      id: `stale-assignment-${node.id}`, code: 'stale-url-assignment', severity: 'notice', provenance: ['asserted', 'measured'],
      title: semanticText('staleTitle', { topic: node.title }),
      detail: semanticText('staleDetail'),
      urls: stale.slice(0, 20), topicId: node.id, evidence: [semanticText('outsideSnapshot', { count: stale.length })], confidence: 'limited',
    });
  }

  for (const [topicId, topicPages] of pagesByTopic) {
      for (const page of topicPages) {
        const matches = topicsByPage.get(page.url) ?? [];
        // Every pagesByTopic entry above was created from a document node.
        const node = document.nodes.find((candidate) => candidate.id === topicId)!;
        matches.push(node);
        topicsByPage.set(page.url, matches);
      }
  }

  return { pagesByTopic, topicsByPage };
};
