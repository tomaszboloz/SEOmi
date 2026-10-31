import type { CrawledPageSummary } from '@/types';
import type { SemanticMap } from '@/services/semanticGraph/types';
import { compareParity, type LanguageCoverage, type ParityReport } from '@/services/hreflangParity/parity';
import { buildClusters, normalizeUrl } from '@/services/hreflangParity/cluster';
import { parityTopicKey, type ParityExceptions } from '@/services/hreflangParity/exceptions';
import type { LanguageTopic } from '@/services/entityIds';

const primary = (code: string): string => code.trim().toLowerCase().split('-')[0];
const langOf = (p: CrawledPageSummary): string => primary(p.document_language ?? '');

/**
 * Language of each page that belongs to an hreflang cluster, taken from the cluster's own annotations
 * (x-default excluded) and falling back to the declared document language. Empty when no cluster exists.
 */
const clusterLanguages = (pages: CrawledPageSummary[]) => {
  const clusters = buildClusters(pages.map((p) => ({ url: p.url, hreflangs: Array.isArray(p.hreflangs) ? p.hreflangs : [] })));
  const byUrl = new Map<string, string>();
  clusters.forEach((cluster) => cluster.languages.forEach((urls, code) => {
    if (code !== 'x-default') urls.forEach((url) => { if (!byUrl.has(url)) byUrl.set(url, primary(code)); });
  }));
  const pageByUrl = new Map(pages.map((p) => [normalizeUrl(p.url), p]));
  clusters.forEach((cluster) => cluster.urls.forEach((url) => {
    const page = pageByUrl.get(url);
    if (!byUrl.has(url) && page && langOf(page)) byUrl.set(url, langOf(page));
  }));
  return { clusters, byUrl };
};

/**
 * Depth (words) per crawl topic cluster and language. When the crawl declares hreflang, only pages inside
 * hreflang clusters are compared (Decision (default chosen by agent): without any hreflang annotation the
 * comparison falls back to document language and says so). The reference language is the one with most pages.
 */
/** Words per (language, topic cluster) for the pages in scope, plus the cluster labels and hreflang graph. */
export const languageCoverage = (pages: CrawledPageSummary[], graph: SemanticMap) => {
  const clusterOf = new Map(graph.nodes.map((n) => [n.page.url, n.clusterId]));
  const topicLabels = new Map(graph.nodes.filter((n) => n.clusterLabel).map((n) => [n.clusterId, n.clusterLabel]));
  const { clusters, byUrl } = clusterLanguages(pages);
  const scoped = clusters.length > 0;
  const coverage = new Map<string, LanguageCoverage>();
  const counts = new Map<string, number>();
  pages.forEach((p) => {
    const lang = scoped ? byUrl.get(normalizeUrl(p.url)) : langOf(p);
    const topic = clusterOf.get(p.url);
    if (!lang || !topic) return;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
    const row = coverage.get(lang) ?? new Map<string, number>();
    row.set(topic, (row.get(topic) ?? 0) + p.word_count);
    coverage.set(lang, row);
  });
  return { coverage, counts, topicLabels, clusters, scoped };
};

/** Labelled topics of every language version, the input of the Wikidata entity matching (#99). */
export const languageTopics = (pages: CrawledPageSummary[], graph: SemanticMap): LanguageTopic[] => {
  const { coverage, topicLabels } = languageCoverage(pages, graph);
  return [...coverage].flatMap(([language, row]) => [...row.keys()].flatMap((topic) => {
    const label = topicLabels.get(topic);
    return label ? [{ language, topic, label }] : [];
  })).sort((a, b) => (a.language + a.topic < b.language + b.topic ? -1 : 1));
};

export const buildParityReport = (pages: CrawledPageSummary[], graph: SemanticMap, exceptions: ParityExceptions = {}): ParityReport => {
  const { coverage, counts, topicLabels, clusters, scoped } = languageCoverage(pages, graph);
  const referenceLanguage = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? '';
  const topics = new Set([...coverage.values()].flatMap((row) => [...row.keys()]));
  const localExceptions = new Map(Object.entries(exceptions).map(([language, byTopic]) =>
    [language, new Set([...topics].filter((topic) => byTopic[parityTopicKey(topic, topicLabels.get(topic))]))]));
  const report = compareParity({ referenceLanguage, coverage, topicLabels, localExceptions, complete: pages.length > 0 && !graph.truncated });
  const rows = report.rows.map((row) => {
    const reason = row.status === 'intentionally-local' ? exceptions[row.language]?.[parityTopicKey(row.topic, row.label)]?.reason : undefined;
    return reason ? { ...row, reason } : row;
  });
  return {
    ...report, rows, scope: scoped ? 'hreflang-clusters' : 'document-language',
    clusters: clusters.length, graphIssues: clusters.reduce((sum, cluster) => sum + cluster.issues.length, 0),
  };
};
