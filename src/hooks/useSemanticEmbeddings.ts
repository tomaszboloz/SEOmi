import { useEffect, useState } from 'react';
import {
  loadSemanticSet, readSemanticSettings, SEMANTIC_SETTINGS_EVENT, type EmbeddingSet, type ProviderFailure, type TextPage,
} from '@/services/semanticSource';

export interface SemanticState { set: EmbeddingSet | undefined; status: 'off' | 'loading' | 'ready' | 'fallback'; failure: ProviderFailure | null }
const OFF: SemanticState = { set: undefined, status: 'off', failure: null };

/**
 * Optional neural similarity for SFS and TAS (#86). Returns `set: undefined` until embeddings exist or
 * when disabled or failing, so reports stay on honest TF-IDF and show it in their similarity source.
 */
export const useSemanticEmbeddings = (projectId: string | null | undefined, pages: readonly TextPage[]): SemanticState => {
  const [state, setState] = useState<SemanticState>(OFF);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const bump = () => setRevision((value) => value + 1);
    window.addEventListener(SEMANTIC_SETTINGS_EVENT, bump);
    return () => window.removeEventListener(SEMANTIC_SETTINGS_EVENT, bump);
  }, []);
  useEffect(() => {
    const settings = readSemanticSettings();
    if (!settings.enabled || !projectId || !pages.length) { setState(OFF); return undefined; }
    const controller = new AbortController();
    setState({ set: undefined, status: 'loading', failure: null });
    void loadSemanticSet({ settings, projectId, pages, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status === 'ready') setState({ set: result.set, status: 'ready', failure: null });
      else setState({ set: undefined, status: result.status === 'off' ? 'off' : 'fallback', failure: result.status === 'fallback' ? result.error?.code ?? null : null });
    });
    return () => controller.abort();
  }, [projectId, pages, revision]);
  return state;
};
