import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildTermDictionary, loadTermDictionary, MAX_USER_TEXT_CHARS, readDictionarySettings, saveDictionarySettings,
  MESH_SEED_SOURCE, MESH_SEED_TERMS,
} from '@/services/llmEconomy';

const base = { useMeshSeed: false, userText: '', userSource: '', importedAt: null };

beforeEach(() => localStorage.clear());

describe('YMYL dictionary store', () => {
  it('defaults to the MeSH seed only', () => {
    expect(readDictionarySettings()).toEqual({ ...base, useMeshSeed: true });
    const dictionary = loadTermDictionary();
    expect(dictionary?.source).toBe(MESH_SEED_SOURCE);
    expect(dictionary?.terms.has('metformin')).toBe(true);
    expect(MESH_SEED_TERMS.length).toBeLessThan(100);
  });

  it('returns null when seed is off and no list is imported', () => {
    expect(buildTermDictionary(base)).toBeNull();
  });

  it('uses only the imported list when seed is off', () => {
    const dictionary = buildTermDictionary({ ...base, userText: 'E11;Type 2 diabetes', userSource: 'icd.csv', importedAt: '2026-01-01T00:00:00.000Z' });
    expect(dictionary?.source).toBe('icd.csv');
    expect([...dictionary!.terms]).toEqual(['e11', 'type 2 diabetes']);
    expect(dictionary?.importedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('merges seed and imported list and names a fallback source', () => {
    const dictionary = buildTermDictionary({ ...base, useMeshSeed: true, userText: 'Zolpidem' });
    expect(dictionary?.source).toBe(`${MESH_SEED_SOURCE} + user list`);
    expect(dictionary?.terms.has('zolpidem')).toBe(true);
    expect(dictionary?.terms.has('aspirin')).toBe(true);
    expect(dictionary?.importedAt).toBe('');
  });

  it('round-trips through storage and truncates oversized text', () => {
    expect(saveDictionarySettings({ ...base, userText: 'x'.repeat(MAX_USER_TEXT_CHARS + 5) }).ok).toBe(true);
    expect(readDictionarySettings().userText).toHaveLength(MAX_USER_TEXT_CHARS);
  });

  it('falls back to defaults for invalid stored data', () => {
    localStorage.setItem('seomi_ymyl_dictionary_v1', JSON.stringify({ schemaVersion: 1, data: { useMeshSeed: 'yes' } }));
    expect(readDictionarySettings().useMeshSeed).toBe(true);
    expect(readDictionarySettings().userText).toBe('');
  });

  it('rejects non-object stored data', () => {
    localStorage.setItem('seomi_ymyl_dictionary_v1', JSON.stringify({ schemaVersion: 1, data: null }));
    expect(readDictionarySettings().userText).toBe('');
  });
});
