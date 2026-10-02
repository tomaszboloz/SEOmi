import type { CrawledPageSummary } from '@/types';
import type { SemanticTopicEdge } from './types';
import i18n from '@/i18n';
import { normalizeSemanticText } from '@/services/semanticText';

export const MAX_TOPIC_EDGES = 5_000;

export const buildSemanticTopics = (selectedPages: CrawledPageSummary[]) => {
  const termsByPage = selectedPages.map((page) =>
    [...new Set((page.semantic_terms ?? []).map(normalizeSemanticText).filter(Boolean))].slice(0, 40),
  );
  const documentFrequency = new Map<string, number>();
  termsByPage.forEach((terms) => terms.forEach((term) => documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)));
  const parent = selectedPages.map((_, index) => index);
  const topicEdges: SemanticTopicEdge[] = [];
  let totalTopicEdges = 0;
  const find = (index: number): number => {
    if (parent[index] !== index) parent[index] = find(parent[index]);
    return parent[index];
  };
  const union = (left: number, right: number) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };

  for (let left = 0; left < termsByPage.length; left += 1) {
    const leftTerms = new Set(termsByPage[left]);
    if (!leftTerms.size) continue;
    for (let right = left + 1; right < termsByPage.length; right += 1) {
      const rightTerms = new Set(termsByPage[right]);
      let shared = 0;
      let intersectionWeight = 0;
      let unionWeight = 0;
      const vocabulary = new Set([...leftTerms, ...rightTerms]);
      for (const term of vocabulary) {
        // Every vocabulary term came from the same normalized page inventories.
        const weight = Math.log(1 + selectedPages.length / documentFrequency.get(term)!);
        unionWeight += weight;
        if (leftTerms.has(term) && rightTerms.has(term)) {
          shared += 1;
          intersectionWeight += weight;
        }
      }
      // At least two shared content terms, with a weighted Jaccard floor. This is a
      // transparent lexical heuristic, not a language model or a ranking score.
      // The non-empty left inventory guarantees a positive union weight.
      const weightedJaccard = intersectionWeight / unionWeight;
      if (shared >= 2 && weightedJaccard >= 0.16) {
        union(left, right);
        totalTopicEdges += 1;
        if (topicEdges.length < MAX_TOPIC_EDGES) {
          topicEdges.push({
            id: `topic-page-${left}->page-${right}`,
            source: `page-${left}`,
            target: `page-${right}`,
            sharedTerms: [...leftTerms].filter((term) => rightTerms.has(term)).sort().slice(0, 8),
            weightedJaccard,
          });
        }
      }
    }
  }

  const groupMembers = new Map<number, number[]>();
  selectedPages.forEach((_, index) => {
    const root = find(index);
    groupMembers.set(root, [...(groupMembers.get(root) ?? []), index]);
  });
  const groupDetails = new Map<number, { id: string; label: string }>();
  for (const [root, members] of groupMembers) {
    const counts = new Map<string, number>();
    members.forEach((index) => termsByPage[index].forEach((term) => counts.set(term, (counts.get(term) ?? 0) + 1)));
    const label = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
      // A group with any terms necessarily has a non-empty count inventory.
      ?? i18n.t('runtimeErrors.semanticMap.noSignals');
    groupDetails.set(root, { id: `cluster-${members[0]}`, label });
  }

  return { termsByPage, topicEdges, totalTopicEdges, groupMembers, groupDetails, find };
};
