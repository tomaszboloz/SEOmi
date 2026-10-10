import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAsyncOperationScope } from '@/hooks/useAsyncOperationScope';
import { z } from 'zod';
import { readJsonRecord } from '@/services/storageContracts';
import { writeJsonStorage } from '@/services/storage';
import type { SerpSnapshot } from '@/services/serpImport';
import {
  clusterKeywordsByEmbedding, EMBEDDING_PROVIDERS, embeddingClusteringResultSchema,
  type EmbeddingClusteringResult, type EmbeddingProviderName,
} from '@/services/embeddingClustering';

export interface EmbeddingSettings {
  provider: EmbeddingProviderName;
  /** null = the provider's calibrated default. */
  threshold: number | null;
  ollamaModel: string;
  labelModel: string;
}

const DEFAULT_SETTINGS: EmbeddingSettings = { provider: 'local', threshold: null, ollamaModel: 'nomic-embed-text', labelModel: '' };
const sessionKey = (projectId: string) => `seomi_project_${projectId}_embedding_clustering_v1`;

const StoredSession = z.object({
  provider: z.enum(EMBEDDING_PROVIDERS).catch('local'),
  threshold: z.number().min(0.01).max(0.99).nullable().catch(null),
  ollamaModel: z.string().max(120).catch(DEFAULT_SETTINGS.ollamaModel),
  labelModel: z.string().max(120).catch(''),
  result: embeddingClusteringResultSchema.nullable().catch(null),
});

export const loadEmbeddingSession = (projectId: string | null): { settings: EmbeddingSettings; result: EmbeddingClusteringResult | null } => {
  if (!projectId) return { settings: DEFAULT_SETTINGS, result: null };
  try {
    const parsed = StoredSession.safeParse(readJsonRecord(sessionKey(projectId)));
    if (!parsed.success) return { settings: DEFAULT_SETTINGS, result: null };
    const { result, ...settings } = parsed.data;
    return { settings, result };
  } catch {
    return { settings: DEFAULT_SETTINGS, result: null };
  }
};

/** Embedding clustering for one project: settings and last result persist per project. */
export const useEmbeddingClustering = (projectId: string | null, keywords: string[], serpSnapshots: SerpSnapshot[] = []) => {
  const [state, setState] = useState(() => loadEmbeddingSession(projectId));
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ownerKey = JSON.stringify([projectId, keywords, state.settings, serpSnapshots]);
  const ownerToken = useMemo(() => Symbol(ownerKey), [ownerKey]);
  const owner = useRef<symbol | null>(null);
  const begin = useAsyncOperationScope(ownerKey);
  useLayoutEffect(() => {
    owner.current = ownerToken;
    setIsRunning(false);
    setError(null);
    return () => { owner.current = null; };
  }, [ownerToken]);
  const ownsView = () => owner.current === ownerToken;

  useEffect(() => {
    setState(loadEmbeddingSession(projectId));
    setIsRunning(false);
    setError(null);
  }, [projectId]);

  const persist = (next: typeof state) => {
    if (!ownsView()) return;
    setState(next);
    if (projectId) writeJsonStorage(sessionKey(projectId), { ...next.settings, result: next.result });
  };

  const updateSettings = (patch: Partial<EmbeddingSettings>) => {
    if (!ownsView()) return;
    begin('clustering');
    setIsRunning(false);
    setError(null);
    persist({ settings: { ...state.settings, ...patch }, result: state.result });
  };

  const run = async () => {
    if (!ownsView()) return;
    const isCurrent = begin('clustering');
    setIsRunning(true);
    setError(null);
    try {
      const result = await clusterKeywordsByEmbedding(keywords, { ...state.settings, ...(serpSnapshots.length ? { serpSnapshots } : {}) });
      if (isCurrent()) persist({ settings: state.settings, result });
    } catch (caught) {
      if (isCurrent()) setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (isCurrent()) setIsRunning(false);
    }
  };

  return { settings: state.settings, result: state.result, isRunning, error, updateSettings, run };
};
