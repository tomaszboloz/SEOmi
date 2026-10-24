import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('snapshot evidence label locales', () => {
  it.each(['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh'])('keeps %s translated and canonically formatted', (language) => {
    const text = readFileSync(`src/i18n/locales/${language}.json`, 'utf8');
    const json = JSON.parse(text);
    expect(json.decayUi.snapshots).toContain('{{count}}');
    expect(text).toBe(`${JSON.stringify(json, null, 2)}\n`);
  });
});
