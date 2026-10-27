import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import i18n from '../src/i18n';
import { locales } from './fixtures/i18nContracts';

const CAUSAL_VERDICTS = ['positive', 'negative', 'noEffect', 'inconclusive'] as const;
const CAUSAL_METADATA_KEYS = [
  'title', 'empty', 'updateWindow', 'normalized', 'unknown',
  'marketUnavailable', 'controlUnavailable', 'updateWindowReason', 'disclaimer',
] as const;

describe('geminiEasy02 - causal labels i18n regression in all 12 locales', () => {
  beforeAll(() => {
    for (const { code, data } of locales) {
      if (code !== 'en') i18n.addResourceBundle(code, 'translation', data, true, true);
    }
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it.each(locales)('resolves all causal verdicts without key leakage in $code', ({ code }) => {
    for (const verdict of CAUSAL_VERDICTS) {
      const text = i18n.t(`causalMarket.${verdict}`, { lng: code });
      expect(typeof text, `Missing causal verdict ${verdict} in ${code}`).toBe('string');
      expect(text.trim().length, `Empty causal verdict ${verdict} in ${code}`).toBeGreaterThan(0);
      expect(text, `Raw key leaked for verdict ${verdict} in ${code}`).not.toContain('causalMarket');
    }
  });

  it.each(locales)('resolves causal reasons, constraints, and disclaimers in $code', ({ code }) => {
    for (const key of CAUSAL_METADATA_KEYS) {
      const text = i18n.t(`causalMarket.${key}`, { lng: code });
      expect(typeof text, `Missing causal key ${key} in ${code}`).toBe('string');
      expect(text.trim().length, `Empty causal key ${key} in ${code}`).toBeGreaterThan(0);
      expect(text, `Raw key leaked for ${key} in ${code}`).not.toContain('causalMarket');
      expect(text, `Unreplaced placeholder in ${key} in ${code}`).not.toMatch(/{{\s*[^}]+\s*}}/);
    }
  });

  it.each(locales)('interpolates causal effect estimate and uncertainty window in $code', ({ code }) => {
    const text = i18n.t('causalMarket.effect', {
      lng: code,
      effect: '+4.2%',
      lower: '+1.1%',
      upper: '+7.3%',
    });
    expect(text.trim().length, `Empty causalMarket.effect in ${code}`).toBeGreaterThan(0);
    expect(text).not.toContain('causalMarket');
    expect(text).not.toMatch(/{{\s*[^}]+\s*}}/);
    expect(text).toContain('+4.2%');
    expect(text).toContain('+1.1%');
    expect(text).toContain('+7.3%');
  });

  it.each(locales)('interpolates causal market and control evidence descriptors in $code', ({ code }) => {
    const text = i18n.t('causalMarket.evidence', {
      lng: code,
      market: 'market-baseline-v1',
      control: 'unmodified-cohort-v1',
    });
    expect(text.trim().length, `Empty causalMarket.evidence in ${code}`).toBeGreaterThan(0);
    expect(text).not.toContain('causalMarket');
    expect(text).not.toMatch(/{{\s*[^}]+\s*}}/);
    expect(text).toContain('market-baseline-v1');
    expect(text).toContain('unmodified-cohort-v1');
  });

  it.each(locales)('resolves causal summary when active language flips to $code', async ({ code }) => {
    await i18n.changeLanguage(code);
    expect(i18n.language).toBe(code);

    const title = i18n.t('causalMarket.title');
    const positive = i18n.t('causalMarket.positive');
    const disclaimer = i18n.t('causalMarket.disclaimer');

    expect(title.trim().length).toBeGreaterThan(0);
    expect(positive.trim().length).toBeGreaterThan(0);
    expect(disclaimer.trim().length).toBeGreaterThan(0);

    expect(title).not.toContain('causalMarket');
    expect(positive).not.toContain('causalMarket');
    expect(disclaimer).not.toContain('causalMarket');
  });
});
