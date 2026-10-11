import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en.json';
import pl from '@/i18n/locales/pl.json';

describe('topical evidence count labels', () => {
  it.each([
    ['en', en, 'Pages: 1', 'Pairs: 1'],
    ['pl', pl, 'Liczba stron: 1', 'Liczba par: 1'],
  ] as const)('renders one item without the incorrect plural sentence in %s', async (language, dictionary, pages, pairs) => {
    const instance = createInstance();
    await instance.init({ lng: language, resources: { [language]: { translation: dictionary } } });
    expect(instance.t('topicalDiagnosis.evidence.count', { count: 1 })).toBe(pages);
    expect(instance.t('topicalDiagnosis.evidence.pairs', { count: 1 })).toBe(pairs);
    expect(instance.t('topicalDiagnosis.evidence.pairs', { count: 2 })).toContain('2');
  });
});
