import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DATAFORSEO_MARKETS, dataForSeoLanguage, dataForSeoLanguageLabel,
  dataForSeoMarketLabel, requireDataForSeoMarket,
} from '@/services/dataforseo/dataforseoMarkets';

vi.mock('@/services/dataforseoCatalog', () => {
  const row = {
    locationCode: 2616, locationCodeParent: null, locationName: 'Poland',
    countryIsoCode: 'PL', locationType: 'Country', languageName: 'Polish',
    languageCode: 'pl', availableSources: 'google', keywords: 0, serps: 0,
  };
  return { DATAFORSEO_LOCATION_CATALOG: [
    row, { ...row, availableSources: 'bing' },
    { ...row, languageCode: 'en', languageName: 'English', availableSources: 'google' },
  ] };
});

afterEach(() => vi.restoreAllMocks());

describe('provider market grouping and label fallback contracts', () => {
  it('deduplicates languages while retaining every source and catalog row', () => {
    expect(DATAFORSEO_MARKETS).toHaveLength(1);
    const market = requireDataForSeoMarket('PL');
    expect(market.languages).toEqual([
      { code: 'pl', label: 'Polish' }, { code: 'en', label: 'English' },
    ]);
    expect(market.availableSources).toBe('google,bing');
    expect(market.catalogRows).toHaveLength(3);
    expect(dataForSeoLanguage('PL', ' EN ')).toBe('en');
  });

  it('uses catalog labels or raw language code when Intl returns no label', () => {
    const NativeDisplayNames = Intl.DisplayNames;
    vi.spyOn(Intl, 'DisplayNames').mockImplementation(class extends NativeDisplayNames {
      override of() { return undefined; }
    });
    expect(dataForSeoMarketLabel(requireDataForSeoMarket('PL'))).toBe('Poland');
    expect(dataForSeoLanguageLabel({ code: 'pl', label: 'Polish' })).toBe('Polish');
    expect(dataForSeoLanguageLabel({ code: 'pl' })).toBe('pl');
  });

  it('defaults to English only when a market contains no language choices', () => {
    const market = requireDataForSeoMarket('PL');
    const languages = market.languages;
    try {
      market.languages = [];
      expect(dataForSeoLanguage('PL', 'de')).toBe('en');
    } finally {
      market.languages = languages;
    }
  });
});
