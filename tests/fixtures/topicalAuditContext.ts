import { createEmptyTopicalMap, type TopicalNode } from '@/services/topicalMap';
import type { CrawledPageSummary } from '@/types';
import type { TopicalAuditContext } from '@/services/topicalAudit/types';

export const auditContext = (pages: CrawledPageSummary[] = [], nodes: TopicalNode[] = []): TopicalAuditContext => ({
  document: { ...createEmptyTopicalMap(), nodes }, pages, findings: [],
  pagesByTopic: new Map(nodes.map((node) => [node.id, pages.filter((page) => node.sourceUrls.includes(page.url))])),
  topicsByPage: new Map(pages.map((page) => [page.url, nodes.filter((node) => node.sourceUrls.includes(page.url))])),
});
