import { DataForSEOSerpItem } from '@/types';
import { asRecord, asArray, number, text } from './dataforseoHelpers';
import { DataForSEOCore } from './dataforseoCore';

const SERP_REGULAR = '/v3/serp/google/organic/live/regular';
/** Same organic results plus SERP features such as People Also Ask; billed separately by DataForSEO (opt-in only). */
export const SERP_ADVANCED = '/v3/serp/google/organic/live/advanced';
const MAX_QUESTIONS = 20;

const organicOf = (items: unknown): DataForSEOSerpItem[] =>
  asArray(items).map(asRecord).filter((item) => text(item.type) === 'organic').map((item) => ({
    type: text(item.type), rank_group: number(item.rank_group), rank_absolute: number(item.rank_absolute),
    domain: text(item.domain), title: text(item.title), description: text(item.description), url: text(item.url),
  }));

/** People Also Ask questions exactly as Google showed them in the SERP (deduplicated, original order). */
export const peopleAlsoAskOf = (items: unknown): string[] => {
  const questions = asArray(items).map(asRecord).filter((item) => text(item.type) === 'people_also_ask')
    .flatMap((block) => asArray(block.items).map(asRecord))
    .map((element) => text(element.title).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return [...new Set(questions)].slice(0, MAX_QUESTIONS);
};

export const getSerpCompetitors = async (client: DataForSEOCore, keyword: string, locationCode = 2840, languageCode = 'en', allowPartial = false): Promise<DataForSEOSerpItem[]> => {
  const result = (await client.post(SERP_REGULAR, [{ keyword, location_code: locationCode, language_code: languageCode, depth: 100 }], allowPartial ? [40106] : []))[0];
  return organicOf(result?.items);
};

/** Organic results and the real People Also Ask block of the same SERP (advanced endpoint). */
export const getSerpWithQuestions = async (client: DataForSEOCore, keyword: string, locationCode = 2840, languageCode = 'en'): Promise<{ organic: DataForSEOSerpItem[]; questions: string[] }> => {
  const result = (await client.post(SERP_ADVANCED, [{ keyword, location_code: locationCode, language_code: languageCode, depth: 100 }]))[0];
  return { organic: organicOf(result?.items), questions: peopleAlsoAskOf(result?.items) };
};
