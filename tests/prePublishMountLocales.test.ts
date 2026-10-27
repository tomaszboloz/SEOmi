import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import en from '@/i18n/locales/en.json';

it.each(['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh'])('has complete, formatted mount-only translations in %s', (locale) => {
  const source = readFileSync(`src/i18n/locales/${locale}.json`, 'utf8');
  const data = JSON.parse(source);
  expect(source).toBe(`${JSON.stringify(data, null, 2)}\n`);
  expect(Object.keys(data.prePublishMountUi)).toEqual(Object.keys(en.prePublishMountUi));
  for (const [key, value] of Object.entries(data.prePublishMountUi)) {
    expect(typeof value).toBe('string');
    expect((value as string).trim().length).toBeGreaterThan(0);
    if (locale !== 'en') expect(value).not.toBe(en.prePublishMountUi[key as keyof typeof en.prePublishMountUi]);
  }
});
