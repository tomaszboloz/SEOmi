import i18n from '@/i18n';
import { KeywordIdea } from '@/types';
import { asRecord, asArray, number, nullableNumber, text, intent } from './dataforseoHelpers';
import { DataForSEOCore } from './dataforseoCore';

/** Related live suggestions from Google Ads keyword data, never synthetic expansions. */
export const getKeywordIdeas = async (client: DataForSEOCore, keyword: string, locationCode: number, languageCode = 'en'): Promise<KeywordIdea[]> => {
  const result = await client.post('/v3/keywords_data/google_ads/keywords_for_keywords/live', [{ keywords: [keyword], location_code: locationCode, language_code: languageCode }]);
  // Google Ads returns keyword rows directly in task.result, while other
  // DataForSEO endpoints wrap rows in an `items` property. Support both
  // documented envelopes and fail loudly for a non-empty unknown shape.
  const rows = result.flatMap((item) => {
    const record = asRecord(item);
    return Array.isArray(record.items) ? asArray(record.items).map(asRecord) : [record];
  });
  if (result.length > 0 && !rows.some((row) => text(row.keyword))) {
    const hasKnownEmptyEnvelope = result.every((item) => Array.isArray(asRecord(item).items));
    if (!hasKnownEmptyEnvelope) throw new Error(i18n.t('runtimeErrors.dataforseo.keywordShape'));
  }
  return rows.map((item) => {
    const searchIntent = asRecord(item.search_intent_info);
    const monthlySearches = asArray(item.monthly_searches).map((month) => {
      const value = asRecord(month);
      return {
        year: nullableNumber(value.year),
        month: nullableNumber(value.month),
        searchVolume: nullableNumber(value.search_volume),
      };
    });
    return {
      keyword: text(item.keyword), search_volume: number(item.search_volume), cpc: number(item.cpc),
      competition: number(item.competition_index) / 100, difficulty: number(item.competition_index),
      intent: intent(searchIntent.main_intent), trend: monthlySearches.map((month) => month.searchVolume ?? 0),
      sourceMetrics: {
        searchVolume: nullableNumber(item.search_volume),
        cpc: nullableNumber(item.cpc),
        competitionIndex: nullableNumber(item.competition_index),
        intent: text(searchIntent.main_intent) || null,
        monthlySearches,
      },
    };
  }).filter((item) => item.keyword);
};
