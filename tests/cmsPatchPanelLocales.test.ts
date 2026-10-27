import i18n from '@/i18n';
import { beforeEach, expect, it } from 'vitest';

const locales = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh'];
beforeEach(async () => { await i18n.changeLanguage('en'); });
it.each(locales)('provides the complete new namespace and placeholders in %s', async (locale) => {
  const english = (await import('@/i18n/locales/en.json')).default.cmsPanelUi;
  const block = (await import(`@/i18n/locales/${locale}.json`)).default.cmsPanelUi;
  expect(Object.keys(block).sort()).toEqual(Object.keys(english).sort());
  for (const [key, value] of Object.entries(english)) {
    expect(typeof block[key]).toBe('string');
    expect(block[key].trim()).not.toBe('');
    expect(block[key].match(/{{\w+}}/g) ?? []).toEqual(value.match(/{{\w+}}/g) ?? []);
  }
  if (locale !== 'en') expect(block.title).not.toBe(english.title);
});
