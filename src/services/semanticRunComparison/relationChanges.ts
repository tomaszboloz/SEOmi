import type { CrawledPageSummary } from '@/types';
import type { AddSemanticChange } from './types';
import { comparisonText, countSemanticLinks, countTopicEdges } from './evidence';

export const compareRelationChanges = (beforePages: CrawledPageSummary[], afterPages: CrawledPageSummary[], add: AddSemanticChange): void => {
  const beforeLinks = countSemanticLinks(beforePages);
  const afterLinks = countSemanticLinks(afterPages);
  for (const [key, link] of afterLinks) {
    if (beforeLinks.has(key)) continue;
    add({ id: `content-link-added:${key}`, code: 'content-link-added', direction: 'added', title: comparisonText('linkAddedTitle'),
      detail: comparisonText('linkAddedDetail'),
      urls: [link.source, link.target], evidence: [comparisonText('anchor', { value: link.anchor || comparisonText('missing') })] });
  }
  for (const [key, link] of beforeLinks) {
    if (afterLinks.has(key)) continue;
    add({ id: `content-link-not-observed:${key}`, code: 'content-link-not-observed', direction: 'not-observed', title: comparisonText('linkMissingTitle'),
      detail: comparisonText('linkMissingDetail'),
      urls: [link.source, link.target], evidence: [comparisonText('previousAnchor', { value: link.anchor || comparisonText('missing') })] });
  }

  const beforeTopicEdges = countTopicEdges(beforePages);
  const afterTopicEdges = countTopicEdges(afterPages);
  for (const [key, edge] of afterTopicEdges) {
    if (beforeTopicEdges.has(key)) continue;
    add({
      id: `topic-edge-added:${key}`,
      code: 'topic-edge-added',
      direction: 'added',
      title: comparisonText('topicEdgeAddedTitle'),
      detail: comparisonText('topicEdgeAddedDetail'),
      urls: [edge.source, edge.target],
      evidence: [
        comparisonText('sharedTerms', { value: edge.sharedTerms.join(', ') }),
        comparisonText('weightedJaccard', { value: edge.weightedJaccard.toFixed(3) }),
      ],
    });
  }
  for (const [key, edge] of beforeTopicEdges) {
    if (afterTopicEdges.has(key)) continue;
    add({
      id: `topic-edge-not-observed:${key}`,
      code: 'topic-edge-not-observed',
      direction: 'not-observed',
      title: comparisonText('topicEdgeMissingTitle'),
      detail: comparisonText('topicEdgeMissingDetail'),
      urls: [edge.source, edge.target],
      evidence: [
        comparisonText('sharedTerms', { value: edge.sharedTerms.join(', ') }),
        comparisonText('weightedJaccard', { value: edge.weightedJaccard.toFixed(3) }),
      ],
    });
  }

};
