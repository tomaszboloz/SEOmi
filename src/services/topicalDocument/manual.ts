import type { TopicalQuery, TopicalNode } from './types';
import { cleanText, MAX_QUERIES_PER_NODE } from './primitives';
import { queryKey } from './queries';
const collectManualQueries = (text: string, existingQueries: TopicalQuery[], limit: number): TopicalQuery[] => {
  const existingByText = new Map(existingQueries.map((query) => [query.text, query]));
  const seen = new Set<string>();
  const queries: TopicalQuery[] = [];
  for (const [index, raw] of text.split('\n').entries()) {
    const queryText = cleanText(raw, 240);
    const key = queryKey(queryText);
    if (!queryText || seen.has(key)) continue;
    seen.add(key);
    const preserved = existingByText.get(queryText);
    queries.push(preserved ?? { id: `query-${Date.now().toString(36)}-${index}`, text: queryText, provenance: 'asserted' });
    if (queries.length >= limit) break;
  }
  return queries;
};

export const parseManualTopicalQueries = (text: string, existingQueries: TopicalQuery[]): TopicalQuery[] =>
  collectManualQueries(text, existingQueries, MAX_QUERIES_PER_NODE);

export const updateManualTopicalQueries = (node: TopicalNode, text: string): { queries: TopicalQuery[]; limitReached: boolean } => {
  const importedQueries = node.queries.filter((query) => query.provenance !== 'asserted');
  const available = Math.max(0, MAX_QUERIES_PER_NODE - importedQueries.length);
  const manualQueries = collectManualQueries(text, node.queries.filter((query) => query.provenance === 'asserted'), available + 1);
  return { queries: [...importedQueries, ...manualQueries.slice(0, available)], limitReached: manualQueries.length > available };
};
