import type { TopicalMapDocument, TopicalQueryEvidence } from './types';
import { cleanText, id, MAX_QUERIES_PER_NODE } from './primitives';
import { normalizeQueryEvidence } from './evidence';
export interface TopicalQueryImportResult {
  document: TopicalMapDocument;
  addedCount: number;
  duplicateCount: number;
  updatedCount: number;
  limitReached: boolean;
}

export const queryKey = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
export const queryEvidenceKey = (source: TopicalQueryEvidence) => source.provider === 'Google Search Console'
  ? `${source.provider}|${source.propertyUrl}|${source.startDate}|${source.endDate}`
  : `${source.provider}|${source.countryCode}|${source.locationCode}|${source.languageCode}|${source.seedKeyword}`.toLocaleLowerCase();

export const importTopicalQueries = (
  document: TopicalMapDocument,
  nodeId: string,
  queries: Array<{ text: string; source: TopicalQueryEvidence }>,
): TopicalQueryImportResult => {
  const node = document.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return { document, addedCount: 0, duplicateCount: 0, updatedCount: 0, limitReached: false };
  const nextQueries = [...node.queries];
  const existing = new Map<string, number>(nextQueries.flatMap((query, index) => query.source ? [[`${queryKey(query.text)}|${queryEvidenceKey(query.source)}`, index] as [string, number]] : []));
  let duplicateCount = 0;
  let addedCount = 0;
  let updatedCount = 0;
  let limitReached = false;
  for (const input of queries) {
    const text = cleanText(input.text, 240);
    if (!text) { duplicateCount += 1; continue; }
    const source = normalizeQueryEvidence(input.source);
    if (!source) continue;
    const identity = `${queryKey(text)}|${queryEvidenceKey(source)}`;
    const previousIndex = existing.get(identity);
    if (previousIndex !== undefined) {
      duplicateCount += 1;
      const previous = nextQueries[previousIndex];
      if (source.retrievedAt > previous.source!.retrievedAt) {
        nextQueries[previousIndex] = { ...previous, source };
        updatedCount += 1;
      }
      continue;
    }
    if (nextQueries.length >= MAX_QUERIES_PER_NODE) { limitReached = true; break; }
    existing.set(identity, nextQueries.length);
    nextQueries.push({
      id: id(), text,
      provenance: source.provider === 'Google Search Console' ? 'gsc' : 'dataforseo',
      source,
    });
    addedCount += 1;
  }
  if (!addedCount && !updatedCount) return { document, addedCount: 0, duplicateCount, updatedCount, limitReached };
  return {
    document: { ...document, nodes: document.nodes.map((candidate) => candidate.id === nodeId ? { ...candidate, queries: nextQueries } : candidate) },
    addedCount,
    duplicateCount,
    updatedCount,
    limitReached,
  };
};
