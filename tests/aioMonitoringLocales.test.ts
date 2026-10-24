import { expect, it } from 'vitest';
import { LANGUAGES } from '@/i18n';

interface Locale { monitoringUi: { aioDrop: string; types: { aio: string } } }
const locales = import.meta.glob('../src/i18n/locales/*.json', { eager: true, import: 'default' }) as Record<string, Locale>;

it.each(LANGUAGES)('provides native AIO monitoring controls in $code without fallback', ({ code }) => {
  const namespace = locales[`../src/i18n/locales/${code}.json`].monitoringUi;
  expect(namespace.types.aio.trim().length).toBeGreaterThan(0);
  expect(namespace.aioDrop).toContain('AIO-R');
  expect(namespace.types.aio).not.toContain('monitoringUi.');
});
