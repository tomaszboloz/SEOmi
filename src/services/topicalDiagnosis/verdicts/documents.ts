import { normalizeGraphUrl } from '@/services/semanticGraph/urls';
import type { DiagnosisDocument, DiagnosisVerdict } from '../types';
import { topicalTerms, weightedJaccard } from '../similarity';
import { NEAR_DUPLICATE_MAX_HAMMING } from '../thresholds';
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

/** Bits that differ between two 64-bit SimHash hex strings; null when either is not a hash. */
const hammingDistance = (left: string, right: string): number | null => {
  if (!/^[a-f\d]{16}$/i.test(left) || !/^[a-f\d]{16}$/i.test(right)) return null;
  let bits = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let count = 0;
  while (bits) {
    count += Number(bits & 1n);
    bits >>= 1n;
  }
  return count;
};

const sameLanguages = (left: DiagnosisDocument, right: DiagnosisDocument): boolean =>
  left.languages.join(',') === right.languages.join(',');

/**
 * Document-level checks: no main-content link at all (orphan), links only from
 * listings and no topic (isolated), identical or near-identical text, and a
 * missing language version on a multilingual site.
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
      verdicts.push(verdict('document-orphan', 'fix', 'document', document.id, [document]));
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
  content.forEach((left, index) => content.slice(index + 1).forEach((right) => {
    if (!sameLanguages(left, right)) return;
    const leftHash = left.primaryPage.content_hash;
    const rightHash = right.primaryPage.content_hash;
    const scopeId = `${left.id}:${right.id}`;
    if (leftHash && leftHash === rightHash) {
      verdicts.push(verdict('near-duplicate', 'fix', 'document', scopeId, [left, right], [{ key: 'hash', params: { value: leftHash } }]));
      return;
    }
    const distance = left.primaryPage.content_simhash && right.primaryPage.content_simhash
      ? hammingDistance(left.primaryPage.content_simhash, right.primaryPage.content_simhash) : null;
    if (distance !== null && distance <= NEAR_DUPLICATE_MAX_HAMMING) {
      verdicts.push(verdict('near-duplicate', 'weak', 'document', scopeId, [left, right], [{ key: 'distance', params: { value: distance } }]));
    }
  }));
  return verdicts;
};
