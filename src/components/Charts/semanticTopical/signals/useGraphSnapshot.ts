import { useCallback, useEffect, useState } from 'react';
import type { SemanticMap } from '@/services/semanticGraph/types';

/**
 * Freezes the graph a simulation works on. A newer crawl never changes it under the user's hands;
 * `stale` turns true until `refresh` adopts the latest graph (issue #138).
 */
export const useGraphSnapshot = (graph: SemanticMap): { snapshot: SemanticMap; stale: boolean; refresh: () => void } => {
  const [snapshot, setSnapshot] = useState(graph);
  const [latest, setLatest] = useState(graph);
  useEffect(() => { setLatest(graph); }, [graph]);
  const refresh = useCallback(() => setSnapshot(latest), [latest]);
  return { snapshot, stale: latest !== snapshot, refresh };
};
