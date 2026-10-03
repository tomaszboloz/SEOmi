import type { TopicalQueryEvidence } from './types';
import { cleanText } from './primitives';
export const normalizeMetric = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
export const normalizeQueryEvidence = (raw: unknown): TopicalQueryEvidence | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const retrievedAt = cleanText(source.retrievedAt, 40);
  if (source.provider === 'DataForSEO Google Ads Keywords for Keywords Live') {
    const locationCode = normalizeMetric(source.locationCode);
    const seedKeyword = cleanText(source.seedKeyword, 240);
    const countryCode = cleanText(source.countryCode, 16);
    const languageCode = cleanText(source.languageCode, 16);
    if (!retrievedAt || locationCode === null || !seedKeyword || !countryCode || !languageCode) return undefined;
    const monthlySearches = Array.isArray(source.monthlySearches) ? source.monthlySearches.slice(0, 120).flatMap((rawMonth) => {
      if (!rawMonth || typeof rawMonth !== 'object') return [];
      const month = rawMonth as Record<string, unknown>;
      return [{ year: normalizeMetric(month.year), month: normalizeMetric(month.month), searchVolume: normalizeMetric(month.searchVolume) }];
    }) : [];
    return {
      provider: 'DataForSEO Google Ads Keywords for Keywords Live', retrievedAt, seedKeyword, countryCode,
      locationCode, languageCode, searchVolume: normalizeMetric(source.searchVolume), cpc: normalizeMetric(source.cpc),
      competitionIndex: normalizeMetric(source.competitionIndex), searchIntent: cleanText(source.searchIntent, 80) || null,
      monthlySearches,
    };
  }
  if (source.provider === 'Google Search Console') {
    const propertyUrl = cleanText(source.propertyUrl, 2048);
    const startDate = cleanText(source.startDate, 10);
    const endDate = cleanText(source.endDate, 10);
    const clicks = normalizeMetric(source.clicks);
    const impressions = normalizeMetric(source.impressions);
    const ctr = normalizeMetric(source.ctr);
    const position = normalizeMetric(source.position);
    const maxRowsPerDimension = normalizeMetric(source.maxRowsPerDimension);
    if (!retrievedAt || !propertyUrl || !startDate || !endDate || clicks === null || impressions === null || ctr === null || position === null || maxRowsPerDimension === null) return undefined;
    return {
      provider: 'Google Search Console', retrievedAt, propertyUrl, startDate, endDate, clicks, impressions, ctr, position,
      queryRowsMayBeTruncated: source.queryRowsMayBeTruncated === true, maxRowsPerDimension,
    };
  }
  return undefined;
};
