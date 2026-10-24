import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const languages = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh'];
const flatten = (value: Record<string, unknown>, prefix = ''): Record<string, string> =>
  Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof entry === 'string' ? [[path, entry]] : Object.entries(flatten(entry as Record<string, unknown>, path));
  }));
const english = JSON.parse(readFileSync('src/i18n/locales/en.json', 'utf8'));
const reference = flatten(english.telemetrySourcesUi);

describe('telemetrySourcesUi in all 12 locales', () => {
  it.each(languages)('%s has complete, nonempty translations, matching placeholders and canonical JSON formatting', (language) => {
    const text = readFileSync(`src/i18n/locales/${language}.json`, 'utf8');
    const locale = JSON.parse(text);
    expect(text).toBe(JSON.stringify(locale, null, 2) + '\n');
    const strings = flatten(locale.telemetrySourcesUi);
    expect(Object.keys(strings)).toEqual(Object.keys(reference));
    expect(Object.keys(locale.telemetrySourcesUi.states)).toHaveLength(6);
    for (const [key, translation] of Object.entries(strings)) {
      expect(translation.trim(), key).not.toBe('');
      expect(translation.match(/{{\w+}}/g) ?? [], key).toEqual(reference[key].match(/{{\w+}}/g) ?? []);
    }
  });
});
