import type { CrawledPageSummary } from '@/types';
import i18n from '@/i18n';
import { CrawlDirectoryNode, CrawlDirectoryTree } from "./contracts";
import { finalize } from "./metrics";
import { decodeSegment, makeNode } from "./nodes";

export const buildCrawlDirectoryTree = (pages: CrawledPageSummary[]): CrawlDirectoryTree => {
  const roots = new Map<string, CrawlDirectoryNode>();
  const childIndexes = new WeakMap<CrawlDirectoryNode, Map<string, CrawlDirectoryNode>>();
  let ignoredPageCount = 0;
  for (const page of pages) {
    let url: URL;
    try { url = new URL(page.url); } catch { ignoredPageCount += 1; continue; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') { ignoredPageCount += 1; continue; }
    const origin = url.origin;
    let node: CrawlDirectoryNode = roots.get(origin) ?? makeNode(`origin:${origin}`, origin, 0);
    if (!roots.has(origin)) roots.set(origin, node);
    const segments = url.pathname.split('/').filter(Boolean);
    for (let index = 0; index < segments.length; index += 1) {
      const rawSegment = segments[index];
      let children = childIndexes.get(node);
      if (!children) {
        children = new Map<string, CrawlDirectoryNode>();
        childIndexes.set(node, children);
      }
      let child = children.get(rawSegment);
      if (!child) {
        child = makeNode(`${node.id}/${rawSegment}`, decodeSegment(rawSegment), node.depth + 1);
        children.set(rawSegment, child);
        node.childDirectories.push(child);
      }
      node = child;
    }
    node.ownPages.push(page);
  }

  const rootNodes = Array.from(roots.values()).sort((left, right) => left.name.localeCompare(right.name));
  const combined = makeNode('crawl:root', i18n.t('runtimeErrors.crawl.root'), -1);
  combined.childDirectories = rootNodes;
  const { metrics } = finalize(combined);
  return {
    roots: rootNodes,
    pageCount: metrics.pageCount,
    ignoredPageCount,
    metrics,
  };
};

export const filterCrawlPagesForDirectoryTree = (pages: CrawledPageSummary[], query: string): CrawledPageSummary[] => {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return pages;
  return pages.filter((page) => [page.url, page.title ?? '', page.http_status, page.indexability_status ?? '']
    .join(' ').toLocaleLowerCase().includes(normalized));
};
