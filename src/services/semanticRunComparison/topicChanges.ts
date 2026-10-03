import type { TopicalMapDocument } from '@/services/topicalMap';
import type { AddSemanticChange, PageIndex } from './types';
import { comparisonText, assignedPages, pageIdentity, queryObservation } from './evidence';

export const compareTopicChanges = (document: TopicalMapDocument, beforeIndex: PageIndex, afterIndex: PageIndex, add: AddSemanticChange): void => {
  for (const node of document.nodes) {
    const previousUrls = new Set(assignedPages(node, beforeIndex.byAlias).map(pageIdentity).filter((url): url is string => Boolean(url)));
    const currentUrls = new Set(assignedPages(node, afterIndex.byAlias).map(pageIdentity).filter((url): url is string => Boolean(url)));
    const newlyObserved = [...currentUrls].filter((url) => !previousUrls.has(url));
    const noLongerObserved = [...previousUrls].filter((url) => !currentUrls.has(url));
    if (newlyObserved.length || noLongerObserved.length) add({
      id: `topic-url-coverage:${node.id}`, code: 'topic-url-coverage-changed', direction: 'changed', title: comparisonText('topicCoverageTitle', { topic: node.title }),
      detail: comparisonText('topicCoverageDetail'), topicId: node.id,
      urls: [...newlyObserved, ...noLongerObserved].slice(0, 20), evidence: [comparisonText('previous', { value: `${previousUrls.size}/${node.sourceUrls.length}` }), comparisonText('current', { value: `${currentUrls.size}/${node.sourceUrls.length}` }), comparisonText('new', { count: newlyObserved.length }), comparisonText('absent', { count: noLongerObserved.length })] });

    const beforeTopicPages = assignedPages(node, beforeIndex.byAlias);
    const afterTopicPages = assignedPages(node, afterIndex.byAlias);
    for (const query of node.queries.slice(0, 100)) {
      const before = queryObservation(query.text, beforeTopicPages);
      const after = queryObservation(query.text, afterTopicPages);
      if (!before || !after) continue;
      if (before.matched.length === after.matched.length && before.matched.every(token => after.matched.includes(token))) continue;
      const direction = after.matched.length === before.matched.length ? 'changed' : after.matched.length > before.matched.length ? 'increased' : 'decreased';
      add({ id: `query-observation:${node.id}:${query.id}`, code: 'query-term-observation-changed', direction,
        title: direction === 'changed' ? comparisonText('queryChangedTitle', { query: query.text }) : comparisonText('queryTitle', { direction: direction === 'increased' ? comparisonText('queryMore') : comparisonText('queryLess'), query: query.text }),
        detail: comparisonText('queryDetail'),
        topicId: node.id, urls: [...new Set([...beforeTopicPages, ...afterTopicPages].map((page) => page.url))].slice(0, 20),
        evidence: [comparisonText('query', { provenance: query.provenance, value: query.text }), comparisonText('tokens', { label: comparisonText('previous'), matched: before.matched.length, expected: before.expected.length }), comparisonText('tokens', { label: comparisonText('current'), matched: after.matched.length, expected: after.expected.length }),
          comparisonText('addedSignal', { value: after.matched.filter((token) => !before.matched.includes(token)).join(', ') || comparisonText('missing') }),
          comparisonText('missingSignal', { value: before.matched.filter((token) => !after.matched.includes(token)).join(', ') || comparisonText('missing') })] });
    }
  }

};
