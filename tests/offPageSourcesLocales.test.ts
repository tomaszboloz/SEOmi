import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (locale: string) => readFileSync(resolve(`src/i18n/locales/${locale}.json`), 'utf8');
const flatten = (value: Record<string, unknown>, prefix = ''): Record<string, string> => Object.fromEntries(
  Object.entries(value).flatMap(([key, entry]) => typeof entry === 'string' ? [[`${prefix}${key}`, entry]]
    : Object.entries(flatten(entry as Record<string, unknown>, `${prefix}${key}.`))),
);
const english = flatten(JSON.parse(read('en')).offPageSourcesUi);
describe('off-page source translation contract', () => {
  it.each(['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh'])('has a complete formatted namespace in %s', (locale) => {
    const source = read(locale);
    const parsed = JSON.parse(source);
    expect(source).toBe(JSON.stringify(parsed, null, 2) + '\n');
    const strings = flatten(parsed.offPageSourcesUi);
    expect(Object.keys(strings)).toEqual(Object.keys(english));
    for (const [key, text] of Object.entries(strings)) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect((text.match(/\{\{\w+\}\}/gu) ?? []).sort()).toEqual((english[key].match(/\{\{\w+\}\}/gu) ?? []).sort());
    }
  });
  it('mounts the session-only evidence workflow inside the existing backlink checker', () => {
    const source = readFileSync(resolve('src/components/Domain/BacklinkChecker.tsx'), 'utf8');
    expect(source).toContain('<OffPageSourcesWorkspace profile={backlinkProfile} />');
  });
});
