import { clusterByAverageLinkage, type PageSimilarity } from '@/services/semanticGraph/clustering';
import type { DiagnosisDocument, DiagnosisTopic, SimilarityFn } from './types';
import { NO_HUB_AREA_ID } from './areas';
import { topicLabel } from './labels';
import { topicalTerms, weightedJaccard, type TermStatistics } from './similarity';
import { MAX_TOPIC_PAIRS, TOPIC_MIN_SHARED_TERMS, TOPIC_SIMILARITY_FLOOR } from './thresholds';

export interface TopicPair {
  left: string;
  right: string;
  similarity: number;
  shared: string[];
}

export interface TopicBuild {
  topics: DiagnosisTopic[];
  topicByDocument: Map<string, string>;
  /** Every content pair at or above the floor, in document order. */
  pairs: TopicPair[];
  /** Content documents outside every topic. */
  singletons: string[];
  truncated: boolean;
}

const documentIndex = (id: string): number => Number(id.slice(4));

/**
 * Topics are average-linkage clusters of content documents. A cluster of one
 * document is not a topic: the document stays a singleton of its area.
 */
export const buildTopics = (
  documents: DiagnosisDocument[], areaByDocument: Map<string, string>, stats: TermStatistics, similarity?: SimilarityFn,
): TopicBuild => {
  const content = documents.filter((document) => document.role === 'content');
  const sets = content.map((document) => topicalTerms(document, stats));
  const pairs: TopicPair[] = [];
  const similarities: PageSimilarity[] = [];
  let candidatePairs = 0;
  for (let left = 0; left < content.length; left += 1) {
    if (!similarity && !sets[left].size) continue;
    for (let right = left + 1; right < content.length; right += 1) {
      const lexical = weightedJaccard(sets[left], sets[right], stats.idf);
      const score = similarity ? similarity(content[left], content[right]) : lexical.similarity;
      if (score < TOPIC_SIMILARITY_FLOOR || (!similarity && lexical.shared.length < TOPIC_MIN_SHARED_TERMS)) continue;
      candidatePairs += 1;
      if (pairs.length >= MAX_TOPIC_PAIRS) continue;
      pairs.push({ left: content[left].id, right: content[right].id, similarity: score, shared: lexical.shared });
      similarities.push({ left, right, similarity: score });
    }
  }
  const roots = clusterByAverageLinkage(content.length, similarities, TOPIC_SIMILARITY_FLOOR);
  const members = new Map<number, number[]>();
  roots.forEach((root, index) => members.set(root, [...(members.get(root) ?? []), index]));
  const topicByDocument = new Map<string, string>();
  const topics = [...members.values()].filter((group) => group.length > 1).map((group) => {
    const groupDocuments = group.map((index) => content[index]);
    const id = `topic-${documentIndex(groupDocuments[0].id)}`;
    groupDocuments.forEach((document) => topicByDocument.set(document.id, id));
    const label = topicLabel(groupDocuments, content, stats);
    return {
      id,
      label: label.label,
      labelSource: label.source,
      documentIds: groupDocuments.map((document) => document.id),
      areaIds: [...new Set(groupDocuments.map((document) => areaByDocument.get(document.id) ?? NO_HUB_AREA_ID))].sort(),
    };
  }).sort((a, b) => b.documentIds.length - a.documentIds.length || documentIndex(a.id.replace('topic-', 'doc-')) - documentIndex(b.id.replace('topic-', 'doc-')));
  return {
    topics,
    topicByDocument,
    pairs,
    singletons: content.filter((document) => !topicByDocument.has(document.id)).map((document) => document.id),
    truncated: candidatePairs > MAX_TOPIC_PAIRS,
  };
};
