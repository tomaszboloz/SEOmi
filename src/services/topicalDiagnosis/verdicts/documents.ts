import { normalizeGraphUrl } from '@/services/semanticGraph/urls';
import type { DiagnosisDocument, DiagnosisVerdict } from '../types';
import { topicalTerms, weightedJaccard } from '../similarity';
import { contentDocuments, urlOf, verdict, type VerdictContext } from './context';

interface Nearest { document: DiagnosisDocument; similarity: number; }

const nearestDocument = (document: DiagnosisDocument, others: DiagnosisDocument[], context: VerdictContext): Nearest | null => {
  const terms = topicalTerms(document, context.stats);
  let best: Nearest | null = null;
  for (const other of others) {
    if (other === document) continue;
    const { similarity } = weightedJaccard(terms, topicalTerms(other, context.stats), context.stats.idf);
    if (similarity > 0 && (best === null || similarity > best.similarity)) best = { document: other, similarity };
  }
  return best;
};

/**
 * Document-level checks: no main-content link at all (orphan), links only from
 * listings and no topic (isolated), and a missing language version on a
 * multilingual site.
 */
export const documentVerdicts = (context: VerdictContext): DiagnosisVerdict[] => {
  const { links, topicByDocument, byId, languages, startUrl, contentLinks } = context;
  const verdicts: DiagnosisVerdict[] = [];
  const content = contentDocuments(context);
  const start = normalizeGraphUrl(startUrl);
  content.forEach((document) => {
    const sources = [...(links.incoming.get(document.id) ?? [])];
    // Without captured content links nothing can be said about who links to a document.
    if (contentLinks && !sources.length && !document.urls.has(start)) {
      const orphan = verdict('document-orphan', context.incompleteLinkEvidence ? 'weak' : 'fix', 'document', document.id, [document]);
      if (context.incompleteLinkEvidence) orphan.confidence = 'limited';
      verdicts.push(orphan);
    } else if (sources.length > 0 && !topicByDocument.has(document.id) && sources.every((source) => byId.get(source)?.role === 'hub')) {
      const nearest = nearestDocument(document, content, context);
      verdicts.push(verdict('document-isolated', 'weak', 'document', document.id, [document], nearest ? [
        { key: 'nearest', params: { url: urlOf(nearest.document) } },
        { key: 'similarity', params: { percent: Math.round(nearest.similarity * 100) } },
      ] : []));
    }
    if (languages.length >= 2 && document.languages.length === 1) {
      verdicts.push(verdict('language-pair-missing', 'info', 'document', document.id, [document], [{ key: 'language', params: { language: document.languages[0] } }]));
    }
  });
  return verdicts;
};
