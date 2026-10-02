import { DataForSEOSerpItem } from '@/types';
import { asRecord, asArray, number, text } from './dataforseoHelpers';
import { DataForSEOCore } from './dataforseoCore';

export const getSerpCompetitors = async (client: DataForSEOCore, keyword: string, locationCode = 2840, languageCode = 'en', allowPartial = false): Promise<DataForSEOSerpItem[]> => {
  const result = (await client.post('/v3/serp/google/organic/live/regular', [{ keyword, location_code: locationCode, language_code: languageCode, depth: 100 }], allowPartial ? [40106] : []))[0];
  return asArray(result?.items).map(asRecord).filter((item) => text(item.type) === 'organic').map((item) => ({
    type: text(item.type), rank_group: number(item.rank_group), rank_absolute: number(item.rank_absolute),
    domain: text(item.domain), title: text(item.title), description: text(item.description), url: text(item.url),
  }));
};
