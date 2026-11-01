import { readVersioned, writeVersioned, type VersionedSpec, type WriteOutcome } from '@/services/analysisContracts';
import { MESH_SEED_SOURCE, MESH_SEED_TERMS } from './meshSeed';
import { parseTermDictionary, type TermDictionary } from './termBinding';

/** Persisted YMYL term settings (#137): optional MeSH seed plus the user's own imported list. */
export interface DictionarySettings { useMeshSeed: boolean; userText: string; userSource: string; importedAt: string | null }

export const MAX_USER_TEXT_CHARS = 400_000;
const DEFAULT: DictionarySettings = { useMeshSeed: true, userText: '', userSource: '', importedAt: null };

const isSettings = (value: unknown): value is DictionarySettings => {
  const item = value as Partial<DictionarySettings> | null;
  return Boolean(item) && typeof item === 'object' && typeof item?.useMeshSeed === 'boolean'
    && typeof item.userText === 'string' && typeof item.userSource === 'string'
    && (item.importedAt === null || typeof item.importedAt === 'string');
};

const SPEC: VersionedSpec<DictionarySettings> = { key: 'seomi_ymyl_dictionary_v1', version: 1, migrations: {}, validate: isSettings };

export const readDictionarySettings = (): DictionarySettings => {
  const outcome = readVersioned(SPEC);
  return outcome.status === 'ok' ? outcome.data : { ...DEFAULT };
};

export const saveDictionarySettings = (settings: DictionarySettings): WriteOutcome =>
  writeVersioned(SPEC, { ...settings, userText: settings.userText.slice(0, MAX_USER_TEXT_CHARS) });

/** Effective dictionary: seed terms (when enabled) plus imported terms; null when both are empty. */
export const buildTermDictionary = (settings: DictionarySettings): TermDictionary | null => {
  const seed = settings.useMeshSeed ? MESH_SEED_TERMS.join('\n') : '';
  const user = parseTermDictionary(settings.userText, settings.userSource, settings.importedAt ?? '').dictionary;
  const seeded = parseTermDictionary(seed, MESH_SEED_SOURCE, '').dictionary;
  if (!seeded && !user) return null;
  const source = [seeded ? MESH_SEED_SOURCE : '', user ? settings.userSource || 'user list' : ''].filter(Boolean).join(' + ');
  return { terms: new Set([...(seeded?.terms ?? []), ...(user?.terms ?? [])]), source, importedAt: settings.importedAt ?? '' };
};

export const loadTermDictionary = (): TermDictionary | null => buildTermDictionary(readDictionarySettings());
