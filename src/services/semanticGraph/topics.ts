import type { CrawledPageSummary } from '@/types';
import type { SemanticTopicEdge } from './types';
import { clusterByAverageLinkage, MIN_TOPIC_SIMILARITY, type PageSimilarity } from './clustering';
import { clusterLabel } from './labels';
import { buildTermInventory } from './terms';

export const MAX_TOPIC_EDGES = 5_000;

export const buildSemanticTopics = (selectedPages: CrawledPageSummary[]) => {
  const inventory = buildTermInventory(selectedPages);
  const { termsByPage, topicalTermsByPage, inverseFrequency, displayTerm } = inventory;
  const topicEdges: SemanticTopicEdge[] = [];
  const similarities: PageSimilarity[] = [];
  let totalTopicEdges = 0;

  for (let left = 0; left < topicalTermsByPage.length; left += 1) {
    const leftTerms = topicalTermsByPage[left];
    if (!leftTerms.size) continue;
    for (let right = left + 1; right < topicalTermsByPage.length; right += 1) {
      const rightTerms = topicalTermsByPage[right];
      let shared = 0;
      let intersectionWeight = 0;
      let unionWeight = 0;
      const vocabulary = new Set([...leftTerms, ...rightTerms]);
      for (const term of vocabulary) {
        const weight = inverseFrequency(term);
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
      if (shared >= 2 && weightedJaccard >= MIN_TOPIC_SIMILARITY) {
        similarities.push({ left, right, similarity: weightedJaccard });
        totalTopicEdges += 1;
        if (topicEdges.length < MAX_TOPIC_EDGES) {
          topicEdges.push({
            id: `topic-page-${left}->page-${right}`,
            source: `page-${left}`,
            target: `page-${right}`,
            sharedTerms: [...leftTerms].filter((term) => rightTerms.has(term)).map(displayTerm).sort().slice(0, 8),
            weightedJaccard,
          });
        }
      }
    }
  }

  const clusterRoots = clusterByAverageLinkage(selectedPages.length, similarities);
  const find = (index: number): number => clusterRoots[index];
  const groupMembers = new Map<number, number[]>();
  selectedPages.forEach((_, index) => {
    const root = find(index);
    groupMembers.set(root, [...(groupMembers.get(root) ?? []), index]);
  });
  const groupDetails = new Map<number, { id: string; label: string }>();
  for (const [root, members] of groupMembers) {
    groupDetails.set(root, { id: `cluster-${members[0]}`, label: clusterLabel(members, inventory) });
  }

  return { termsByPage, topicEdges, totalTopicEdges, groupMembers, groupDetails, find };
};
