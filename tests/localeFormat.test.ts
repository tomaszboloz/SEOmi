import { afterEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import { appLocale } from '@/services/localeFormat';

afterEach(async () => { await i18n.changeLanguage('en'); });

it('formats with the selected UI language instead of the operating system locale', async () => {
  await i18n.changeLanguage('en');
  expect(appLocale()).toBe('en');
  expect((2048).toLocaleString(appLocale())).toBe('2,048');
  await i18n.changeLanguage('de');
  expect((2048).toLocaleString(appLocale())).toBe('2.048');
});

it('normalizes underscore language tags to BCP 47', async () => {
  await i18n.changeLanguage('pt_BR');
  expect(appLocale()).toBe('pt-BR');
});
