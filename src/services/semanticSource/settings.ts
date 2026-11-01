import { readVersioned, writeVersioned, type VersionedSpec, type WriteOutcome } from '@/services/analysisContracts';

/**
 * Optional semantic source for Site Focus and Topical Authority (#86). Off by default: without it both
 * modules run on TF-IDF and say so. Ollama is never required and nothing is installed or downloaded.
 */
export interface SemanticSettings {
  enabled: boolean;
  /** Registry provider: `ollama` (neural) or `hybrid` (local hash + Ollama). */
  provider: 'ollama' | 'hybrid';
  /** Empty means the default local Ollama address. */
  ollamaUrl: string;
  model: string;
  timeoutMs: number;
  /** Most texts embedded per run; the rest stay TF-IDF only. */
  maxEntries: number;
}

export const SEMANTIC_SETTINGS_EVENT = 'seomi:semantic-settings';
export const DEFAULT_SEMANTIC_SETTINGS: SemanticSettings = {
  enabled: false, provider: 'ollama', ollamaUrl: '', model: 'nomic-embed-text', timeoutMs: 30_000, maxEntries: 500,
};

const bounded = (value: unknown, min: number, max: number): boolean => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

export const isSemanticSettings = (value: unknown): value is SemanticSettings => {
  const item = value as Partial<SemanticSettings> | null;
  return Boolean(item) && typeof item === 'object' && typeof item?.enabled === 'boolean'
    && (item.provider === 'ollama' || item.provider === 'hybrid')
    && typeof item.ollamaUrl === 'string' && typeof item.model === 'string' && item.model.trim().length > 0
    && bounded(item.timeoutMs, 1000, 300_000) && bounded(item.maxEntries, 1, 5000);
};

const SPEC: VersionedSpec<SemanticSettings> = { key: 'seomi_semantic_source_v1', version: 1, migrations: {}, validate: isSemanticSettings };

export const readSemanticSettings = (): SemanticSettings => {
  const outcome = readVersioned(SPEC);
  return outcome.status === 'ok' ? outcome.data : { ...DEFAULT_SEMANTIC_SETTINGS };
};

export const saveSemanticSettings = (settings: SemanticSettings): WriteOutcome => {
  const outcome = writeVersioned(SPEC, settings);
  if (outcome.ok && typeof window !== 'undefined') window.dispatchEvent(new Event(SEMANTIC_SETTINGS_EVENT));
  return outcome;
};
