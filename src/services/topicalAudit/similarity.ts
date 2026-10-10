import type { TopicalAuditContext } from './types';
import { addFinding, semanticText, termsFor, hammingDistance, MAX_FINDINGS } from './evidence';
import { candidatePagePairs } from './candidates';

export const auditPageSimilarity = (context: TopicalAuditContext) => {
  const { pages, topicsByPage, findings } = context;
  const candidates = candidatePagePairs(pages, topicsByPage);
  for (const [leftIndex, rightIndex] of candidates.pairs) {
      // The candidate cap is already known; omitted findings cannot change it.
      // Stop before building localized evidence that addFinding would discard.
      if (findings.length >= MAX_FINDINGS) break;
      const leftPage = pages[leftIndex];
      const rightPage = pages[rightIndex];
      const leftTopics = topicsByPage.get(leftPage.url) ?? [];
      const rightTopics = topicsByPage.get(rightPage.url) ?? [];
      const sameTopic = leftTopics.some((node) => rightTopics.some((candidate) => candidate.id === node.id));
      const leftTerms = termsFor(leftPage);
      const rightTerms = termsFor(rightPage);
      const shared = [...leftTerms].filter(([key]) => rightTerms.has(key)).map(([, term]) => term);
      const union = new Set([...leftTerms.keys(), ...rightTerms.keys()]);
      const lexicalOverlap = union.size ? shared.length / union.size : 0;
      const simhashDistance = leftPage.content_simhash && rightPage.content_simhash
        ? hammingDistance(leftPage.content_simhash, rightPage.content_simhash) : null;
      const exactDuplicate = Boolean(leftPage.content_hash && leftPage.content_hash === rightPage.content_hash);
      if (exactDuplicate || simhashDistance !== null && simhashDistance <= 7) {
        addFinding(findings, {
          id: `near-duplicate-${leftPage.url}-${rightPage.url}`, code: 'near-duplicate-content', severity: exactDuplicate ? 'risk' : 'review',
          provenance: ['measured', 'derived'], title: exactDuplicate ? semanticText('duplicateTitle') : semanticText('similarityTitle'),
          detail: exactDuplicate ? semanticText('duplicateDetail') : semanticText('similarityDetail'),
          urls: [leftPage.url, rightPage.url], topicId: sameTopic ? leftTopics.find((node) => rightTopics.some((candidate) => candidate.id === node.id))?.id : undefined,
          evidence: [exactDuplicate ? semanticText('contentHash', { value: leftPage.content_hash }) : semanticText('simhash', { value: `${simhashDistance}/64` }), semanticText('sharedTerms', { value: shared.slice(0, 10).join(', ') || semanticText('missingTerm') })], confidence: exactDuplicate ? 'moderate' : 'limited',
        });
      } else if (sameTopic && shared.length >= 3 && lexicalOverlap >= 0.55) {
        addFinding(findings, {
          id: `possible-overlap-${leftPage.url}-${rightPage.url}`, code: 'possible-url-overlap', severity: 'review', provenance: ['asserted', 'measured', 'derived'],
          title: semanticText('overlapTitle'),
          detail: semanticText('overlapDetail'),
          urls: [leftPage.url, rightPage.url], topicId: leftTopics.find((node) => rightTopics.some((candidate) => candidate.id === node.id))?.id,
          evidence: [semanticText('jaccard', { value: lexicalOverlap.toFixed(2) }), semanticText('shared', { value: shared.slice(0, 12).join(', ') })], confidence: 'limited',
        });
      }
  }

  return candidates.truncated;
};
