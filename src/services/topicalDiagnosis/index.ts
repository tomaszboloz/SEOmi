import type { CrawledPageSummary } from '@/types';
import type { TopicalDiagnosisOptions, TopicalDiagnosisReport } from './types';
import { buildDiagnosisDocuments } from './documents';
import { indexDocumentLinks } from './links';
import { assignRoles } from './roles';
import { buildAreas } from './areas';
import { brandKeysFor, buildTermStatistics } from './similarity';
import { buildTopics } from './topics';
import { buildVerdicts } from './verdicts';
import { MAX_DIAGNOSIS_PAGES } from './thresholds';

export type * from './types';
export { NO_HUB_AREA_ID } from './areas';

/**
 * Deterministic topical diagnosis of one crawl run: documents (hreflang pairs
 * merged), hub-based areas, lexical topics and per-URL verdicts. No network,
 * no language model; every number can be recomputed from the saved run.
 */
export const buildTopicalDiagnosis = (
  pages: CrawledPageSummary[], startUrl: string, options: TopicalDiagnosisOptions = {},
): TopicalDiagnosisReport => {
  const { documents: rawDocuments, skippedPages, mergedPairs } = buildDiagnosisDocuments(pages, startUrl);
  const documents = assignRoles(rawDocuments, indexDocumentLinks(rawDocuments));
  const links = indexDocumentLinks(documents);
  const { areas, areaByDocument } = buildAreas(documents, links);
  const stats = buildTermStatistics(documents, brandKeysFor(startUrl, documents));
  const { topics, topicByDocument, pairs, singletons, truncated } = buildTopics(documents, areaByDocument, stats, options.similarity);
  const languages = [...new Set(documents.flatMap((document) => document.languages))].sort();
  const verdicts = buildVerdicts({
    documents, byId: new Map(documents.map((document) => [document.id, document])), links, areas, areaByDocument,
    topics, topicByDocument, pairs, stats, startUrl, languages,
  });
  return {
    documents,
    areas,
    topics,
    verdicts,
    stats: {
      pages: pages.length,
      skippedPages: skippedPages + Math.max(0, pages.length - MAX_DIAGNOSIS_PAGES),
      documents: documents.length,
      hubs: documents.filter((document) => document.role === 'hub').length,
      utilities: documents.filter((document) => document.role === 'utility').length,
      topics: topics.length,
      singletons: singletons.length,
      languages,
      mergedPairs,
    },
    noTerms: documents.every((document) => document.terms.size === 0),
    truncated: pages.length > MAX_DIAGNOSIS_PAGES || truncated,
  };
};
