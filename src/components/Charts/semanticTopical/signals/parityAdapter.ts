import type { CrawledPageSummary } from '@/types';
import type { SemanticMap } from '@/services/semanticGraph/types';
import { compareParity, type LanguageCoverage, type ParityReport } from '@/services/hreflangParity/parity';

const langOf = (p: CrawledPageSummary): string => (p.document_language ?? '').trim().toLowerCase().split('-')[0];

/**
 * Depth (words) per crawl topic cluster and document language. The reference language is the one with
 * most pages. Topics are matched by cluster id, so the report is only conclusive for one shared crawl.
 */
export const buildParityReport = (pages: CrawledPageSummary[], graph: SemanticMap): ParityReport => {
  const clusterOf = new Map(graph.nodes.map((n) => [n.page.url, n.clusterId]));
  const topicLabels = new Map(graph.nodes.filter((n) => n.clusterLabel).map((n) => [n.clusterId, n.clusterLabel]));
  const coverage = new Map<string, LanguageCoverage>();
  const counts = new Map<string, number>();
  pages.forEach((p) => {
    const lang = langOf(p);
    const topic = clusterOf.get(p.url);
    if (!lang || !topic) return;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
    const row = coverage.get(lang) ?? new Map<string, number>();
    row.set(topic, (row.get(topic) ?? 0) + p.word_count);
    coverage.set(lang, row);
  });
  const referenceLanguage = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? '';
  return compareParity({ referenceLanguage, coverage, topicLabels, complete: pages.length > 0 && !graph.truncated });
};
