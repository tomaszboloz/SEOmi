import i18n from '@/i18n';
import { DATAFORSEO_LOCATION_CATALOG } from '@/services/dataforseoCatalog';
import { DataForSeoMarket } from './dataforseoTypes';
import { displayLocale } from './dataforseoHelpers';

const buildDataForSeoMarkets = (): DataForSeoMarket[] => {
  const grouped = new Map<string, DataForSeoMarket>();
  for (const row of DATAFORSEO_LOCATION_CATALOG) {
    const code = row.countryIsoCode.toUpperCase();
    const existing = grouped.get(code);
    const language = { code: row.languageCode, label: row.languageName };
    if (existing) {
      if (!existing.languages.some((item) => item.code === language.code)) existing.languages.push(language);
      existing.availableSources = Array.from(new Set(`${existing.availableSources},${row.availableSources}`.split(',').filter(Boolean))).join(',');
      existing.catalogRows.push(row);
      continue;
    }
    grouped.set(code, {
      code,
      label: row.locationName,
      locationCode: row.locationCode,
      countryIsoCode: row.countryIsoCode,
      locationType: row.locationType,
      availableSources: row.availableSources,
      languages: [language],
      catalogRows: [row],
    });
  }
  return Array.from(grouped.values()).sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
};

export let DATAFORSEO_MARKETS: DataForSeoMarket[] = buildDataForSeoMarkets();
i18n.on('languageChanged', () => { DATAFORSEO_MARKETS = buildDataForSeoMarkets(); });

/** All language codes present in the provider catalogue, useful for clients
 * that need a language-first filter before choosing a location. */
export const DATAFORSEO_LANGUAGES = Array.from(new Map(
  DATAFORSEO_LOCATION_CATALOG.map((row) => [row.languageCode, { code: row.languageCode, label: row.languageName }]),
).values()).sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));

const legacyMarketCodes: Record<string, string> = {
  'united states': 'US',
  poland: 'PL',
  'united kingdom': 'GB',
  uk: 'GB',
  germany: 'DE',
  france: 'FR',
  spain: 'ES',
  italy: 'IT',
  canada: 'CA',
  australia: 'AU',
};

export const resolveDataForSeoMarket = (country: string): DataForSeoMarket | null => {
  const normalized = country.trim().toUpperCase();
  const numeric = Number(normalized);
  if (Number.isInteger(numeric)) {
    return DATAFORSEO_MARKETS.find((market) => market.locationCode === numeric) || null;
  }
  const code = legacyMarketCodes[country.trim().toLowerCase()] || normalized;
  return DATAFORSEO_MARKETS.find((market) => market.code === code) || null;
};

export const requireDataForSeoMarket = (country: string): DataForSeoMarket => {
  const market = resolveDataForSeoMarket(country);
  if (!market) throw new Error(i18n.t('runtimeErrors.dataforseo.marketRequired'));
  return market;
};

export const dataForSeoMarket = (country: string): DataForSeoMarket => {
  return requireDataForSeoMarket(country);
};

export const dataForSeoLocation = (country: string): number => dataForSeoMarket(country).locationCode;

export const dataForSeoMarketByLocation = (locationCode: number): DataForSeoMarket => dataForSeoMarket(String(locationCode));

/** Locale-aware labels with catalogue values as a deterministic fallback. */
export const dataForSeoMarketLabel = (market: DataForSeoMarket): string => {
  try {
    const displayNames = new Intl.DisplayNames([displayLocale()], { type: 'region' });
    return displayNames.of(market.countryIsoCode) || market.label;
  } catch {
    return market.label;
  }
};

export const dataForSeoLanguageLabel = (language: { code: string; label?: string }): string => {
  try {
    const displayNames = new Intl.DisplayNames([displayLocale()], { type: 'language' });
    return displayNames.of(language.code) || language.label || language.code;
  } catch {
    return language.label || language.code;
  }
};

export const dataForSeoLanguage = (country: string, language?: string): string => {
  const market = dataForSeoMarket(country);
  const normalized = language?.trim().toLowerCase();
  const selected = market.languages.find((item) => item.code.toLowerCase() === normalized);
  return selected?.code || market.languages[0]?.code || 'en';
};
