import type { SerpImportRejection, SerpImportResult, SerpSnapshot, SerpSource } from '../serpImport/contracts';

export const MAX_FREE_FEED_BYTES = 1_048_576;
export const MAX_FREE_SERP_RESULTS = 10;
export const MAX_FREE_KEYWORD_LENGTH = 500;
export const FREE_ENGINE_REASON = 'Bing RSS is partial free-engine coverage, not Google SERP equivalent';
export const GOOGLE_SUGGESTIONS_REASON = 'Google Suggest is unofficial best-effort data; requested geo and language are request context only';

export type PublicFeed = 'google-trends' | 'bing-serp' | 'google-suggestions';
export type PublicFeedStatus = 'ok' | 'blocked' | 'error';

export interface PublicFeedRequest {
  feed: PublicFeed;
  geo: string;
  keyword: string;
  language: string;
}

export interface PublicFeedResponse {
  status: PublicFeedStatus;
  sourceUrl: string;
  fetchedAt: string;
  body: string | null;
  httpStatus: number | null;
  error: string | null;
}

export interface FreeSerpResult extends SerpImportResult {
  feed: 'bing-serp';
  fetchedAt: string;
  sourceUrl: string;
  snapshot: SerpSnapshot | null;
}

export type FreeSerpSource = SerpSource;
export type FreeSerpRejection = SerpImportRejection;

export const assertFreeFeedRequest = (request: PublicFeedRequest): void => {
  if (!request || typeof request !== 'object') throw new Error('Public feed request is malformed');
  if (!['google-trends', 'bing-serp', 'google-suggestions'].includes(request.feed)) throw new Error('Unsupported public feed');
  if (typeof request.geo !== 'string' || !/^[A-Za-z]{2}$/.test(request.geo.trim())) throw new Error('Public feed requires a two-letter country');
  if (typeof request.language !== 'string' || !/^[A-Za-z]{2,8}(?:-[A-Za-z]{2,8})?$/.test(request.language.trim())) throw new Error('Public feed requires a valid language');
  if (typeof request.keyword !== 'string' || new TextEncoder().encode(request.keyword).byteLength > MAX_FREE_KEYWORD_LENGTH) throw new Error('Public feed keyword is too long');
  if ((request.feed === 'bing-serp' || request.feed === 'google-suggestions') && !request.keyword.trim()) throw new Error('Public feed requires a keyword');
};

export const normalizeFreeRequest = (request: PublicFeedRequest): PublicFeedRequest => {
  assertFreeFeedRequest(request);
  return { ...request, geo: request.geo.trim().toUpperCase(), language: request.language.trim().toLowerCase(), keyword: request.keyword.trim() };
};
