import type { CrawledPageSummary } from '@/types';
import type { SiteFocusReport } from '@/services/siteFocus';
import { normalizeUrl } from '@/services/siteFocus/pageType';
import { scanAuthors } from './authors';
import { analyzeCitations, citationScore } from './citations';
import { buildFindings, levelFor } from './findings';
import { buildRegistry, isArticleNode, nodesOf, type SchemaNode } from './graph';
import { buildTrustGraph } from './entityGraph';
import { analyzeSchema, schemaScore } from './schemaScore';
import { analyzeTransparency, transparencyScore } from './transparency';
import { EEAT_TRUST_VERSION, TRUST_WEIGHTS, type TrustLayer, type TrustReport } from './types';
import { detectYmyl } from './ymyl';

export interface TrustOptions { now?: string }

const usable = (page: CrawledPageSummary): boolean => page.http_status < 400 && !page.request_error_kind;

/** Weighted mean of the layers that have data; the others are dropped and weights renormalized. */
export const combineLayers = (layers: Partial<Record<TrustLayer, number>>): number => {
  const present = (Object.keys(TRUST_WEIGHTS) as TrustLayer[]).filter((layer) => layers[layer] !== undefined);
  const total = present.reduce((sum, layer) => sum + TRUST_WEIGHTS[layer], 0);
  return total ? Math.round(present.reduce((sum, layer) => sum + (layers[layer] ?? 0) * TRUST_WEIGHTS[layer], 0) / total) : 0;
};

/** E-E-A-T & Entity Trust report from the crawl's own schema, links and pages; the Site Focus report supplies Core Topic and page types. */
export const buildTrustReport = (pages: CrawledPageSummary[], focus?: SiteFocusReport, options: TrustOptions = {}): TrustReport => {
  const live = pages.filter(usable);
  const nodesByPage = new Map<string, SchemaNode[]>(live.map((page) => [page.final_url || page.url, nodesOf(page)]));
  const allNodes = [...nodesByPage.values()].flat();
  const registry = buildRegistry(allNodes);
  const focusArticles = new Set((focus?.pages ?? []).filter((page) => page.type === 'article' && !page.skipped).map((page) => normalizeUrl(page.url)));
  const articleNodes = new Map<string, SchemaNode[]>();
  for (const page of live) {
    const url = page.final_url || page.url;
    const own = (nodesByPage.get(url) ?? []).filter(isArticleNode);
    const typed = (nodesByPage.get(url) ?? []).some((node) => node.types.some((type) => /Article|BlogPosting|MedicalWebPage|NewsMedia/i.test(type)));
    if (focusArticles.has(normalizeUrl(url)) || typed) articleNodes.set(url, own);
  }
  const scan = scanAuthors(live, nodesByPage, articleNodes, registry, focus);
  const graph = buildTrustGraph(live, nodesByPage);
  const articleUrls = new Set(articleNodes.keys());
  const cited = new Map<string, string[]>([...articleNodes].map(([url, list]) => [url, list.flatMap((node) => node.props.citation ?? [])]));
  const citations = analyzeCitations(live, articleUrls, cited);
  const transparency = analyzeTransparency(live, articleNodes);
  const titles = live.filter((page) => articleUrls.has(page.final_url || page.url)).map((page) => page.title ?? '');
  const ymyl = detectYmyl(allNodes, focus, titles);
  const schema = analyzeSchema(allNodes, articleNodes, scan.authors, scan.withAuthor, scan.withReviewer);

  const named = scan.authors.filter((author) => !author.generic);
  const attributed = new Set([...named.flatMap((author) => author.articleUrls), ...scan.withReviewer]);
  const unattributed = articleUrls.size - [...articleUrls].filter((url) => attributed.has(url)).length;
  const alignmentSum = [...articleUrls].reduce((sum, url) => sum + Math.max(0, ...named.filter((author) => author.articleUrls.includes(url)).map((author) => author.alignmentPct ?? 0)), 0);

  const layers: TrustReport['layers'] = {
    schemaGraph: schemaScore(schema, Boolean(ymyl)),
    transparency: transparencyScore(transparency),
    ...(focus && articleUrls.size ? { authorAlignment: Math.round(alignmentSum / articleUrls.size) } : {}),
    ...(citationScore(citations) !== undefined ? { citationQuality: citationScore(citations) } : {}),
  };
  const score = combineLayers(layers);
  return {
    score, level: levelFor(score), layers, ymyl, schema, graph, authors: scan.authors, citations, transparency,
    findings: buildFindings({ schema, authors: scan.authors, citations, transparency, ymyl, unattributed }),
    ymylUnattributedPct: ymyl && articleUrls.size ? Math.round((unattributed / articleUrls.size) * 100) : undefined,
    pageCount: live.length, articleCount: articleUrls.size, generatedAt: options.now ?? new Date().toISOString(), version: EEAT_TRUST_VERSION,
  };
};
