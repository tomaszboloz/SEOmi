import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh'];
const REQUIRED_KEYS = ['title', 'empty', 'spent', 'saved', 'hits', 'leaves', 'remaining', 'overBudget'];

describe('llmEconomy locales parity across all 12 languages', () => {
  it.each(LOCALES)('includes complete llmEconomy bundle in %s.json', (locale) => {
    const file = resolve(__dirname, `../src/i18n/locales/${locale}.json`);
    const content = JSON.parse(readFileSync(file, 'utf8'));
    expect(content.llmEconomy).toBeDefined();
    for (const key of REQUIRED_KEYS) {
      expect(content.llmEconomy[key], `Missing ${key} in ${locale}.json`).toBeDefined();
      expect(typeof content.llmEconomy[key]).toBe('string');
      expect(content.llmEconomy[key].trim().length).toBeGreaterThan(0);
    }
  });
});
