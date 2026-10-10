import type { TopicalDiagnosisReport } from '@/services/topicalDiagnosis';
import { semanticPageTermEntries } from '@/services/semanticText';
import type { TopicalMapDocument } from './types';
import { cleanText, MAX_NODES, MAX_TERMS_PER_NODE } from './primitives';
import { createTopicalNode } from './factories';

/**
 * One topical node per multi-document topic of the diagnosis. Single documents
 * are not topics and are not imported; every language version of a member
 * becomes a source URL. Topics already imported from this run are skipped.
 */
export const importDiagnosisTopics = (
  document: TopicalMapDocument, report: TopicalDiagnosisReport, runId: string, fallbackTitle: string,
): TopicalMapDocument => {
  const existing = new Set(document.nodes.filter((node) => node.sourceRunId === runId).map((node) => node.sourceClusterId));
  const byId = new Map(report.documents.map((entry) => [entry.id, entry]));
  const additions = report.topics.filter((topic) => !existing.has(topic.id)).map((topic) => {
    const members = topic.documentIds.map((id) => byId.get(id)!).filter(Boolean);
    const pages = members.flatMap((member) => member.pages);
    const sourceUrls = [...new Set(pages.map((page) => page.final_url || page.url).filter(Boolean))];
    const seenKeys = new Set<string>();
    const evidenceTerms = pages.flatMap((page) => semanticPageTermEntries(page).map(({ key, surface }) => ({ key, term: cleanText(surface, 100) })))
      .filter(({ key, term }) => {
        if (!term || seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      })
      .map(({ term }) => term)
      .slice(0, MAX_TERMS_PER_NODE);
    return {
      ...createTopicalNode(topic.label || fallbackTitle),
      kind: 'cluster' as const,
      evidenceTerms,
      sourceUrls,
      sourceRunId: runId,
      sourceClusterId: topic.id,
    };
  });
  return { ...document, nodes: [...document.nodes, ...additions].slice(0, MAX_NODES) };
};
