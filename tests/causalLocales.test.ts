import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const languages = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh'];
const locale = (language: string) => readFileSync(`src/i18n/locales/${language}.json`, 'utf8');
const entries = (value: Record<string, unknown>, prefix = ''): [string, string][] =>
  Object.entries(value).flatMap(([key, entry]) => typeof entry === 'string'
    ? [[`${prefix}${key}`, entry]] : entries(entry as Record<string, unknown>, `${prefix}${key}.`));
const english = Object.fromEntries(entries(JSON.parse(locale('en')).causalMarket));

it.each(languages)('provides the complete causalMarket tree and canonical JSON formatting: %s', (language) => {
  const raw = locale(language);
  const parsed = JSON.parse(raw);
  expect(raw).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
  const translated = Object.fromEntries(entries(parsed.causalMarket));
  expect(Object.keys(translated)).toEqual(Object.keys(english));
  expect(Object.keys(translated)).toHaveLength(15);
  for (const [key, text] of Object.entries(translated)) {
    expect(text.trim()).not.toBe('');
    expect(text.match(/{{\w+}}/g) ?? []).toEqual(english[key].match(/{{\w+}}/g) ?? []);
  }
  if (language !== 'en') {
    expect(translated.disclaimer).not.toBe(english.disclaimer);
    expect(translated.title).toBeDefined();
  }
});
