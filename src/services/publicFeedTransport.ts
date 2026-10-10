import { invokeTauriCommand } from '@/services/tauri';
import { assertSerpPayload } from './serpImport/normalize';
import type { FreeSerpResult, PublicFeedRequest, PublicFeedResponse, PublicFeedStatus } from './freeSerp/contracts';
import { FREE_ENGINE_REASON, normalizeFreeRequest } from './freeSerp/contracts';
import { parseBingSerpResponse } from './freeSerp/rss';
import { assertPublicFeedUrl, publicFeedUrl } from './freeSerp/urls';

export type PublicFeedInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export type FreeSerpFetchOutcome =
  | { status: 'ok'; response: PublicFeedResponse; result: FreeSerpResult }
  | { status: 'blocked' | 'error'; response: PublicFeedResponse; result: null };

const statuses: PublicFeedStatus[] = ['ok', 'blocked', 'error'];

const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error);

const responseError = (sourceUrl: string, error: unknown): PublicFeedResponse => ({
  status: 'error', sourceUrl, fetchedAt: new Date().toISOString(), body: null, httpStatus: null, error: messageOf(error),
});

function validateResponse(raw: unknown, request: PublicFeedRequest): PublicFeedResponse {
  if (!raw || typeof raw !== 'object') throw new Error('Public feed response is malformed');
  const value = raw as Partial<PublicFeedResponse>;
  if (!statuses.includes(value.status as PublicFeedStatus)) throw new Error('Public feed response has an invalid status');
  if (typeof value.sourceUrl !== 'string') throw new Error('Public feed response is missing its source URL');
  assertPublicFeedUrl(value.sourceUrl, request);
  if (typeof value.fetchedAt !== 'string' || !Number.isFinite(Date.parse(value.fetchedAt))) throw new Error('Public feed response has an invalid timestamp');
  if (value.httpStatus !== null && value.httpStatus !== undefined && (!Number.isSafeInteger(value.httpStatus) || value.httpStatus < 100 || value.httpStatus > 599)) throw new Error('Public feed response has an invalid HTTP status');
  if (value.body !== null && value.body !== undefined && typeof value.body !== 'string') throw new Error('Public feed response has an invalid body');
  if (value.status === 'ok') {
    if (typeof value.body !== 'string' || value.httpStatus === null || value.httpStatus === undefined || value.httpStatus < 200 || value.httpStatus >= 300) throw new Error('Successful public feed response is incomplete');
    assertSerpPayload(value.body);
    if (value.error !== null && value.error !== undefined) throw new Error('Successful public feed response has an error');
  } else {
    if (value.body !== null && value.body !== undefined) throw new Error('Unavailable public feed response cannot contain a body');
    if (typeof value.error !== 'string' || !value.error.trim()) throw new Error('Unavailable public feed response needs an error');
  }
  const status = value.status as PublicFeedStatus;
  return { status, sourceUrl: value.sourceUrl, fetchedAt: value.fetchedAt, body: value.body ?? null, httpStatus: value.httpStatus ?? null, error: value.error ?? null };
}

export async function fetchPublicFeed(request: PublicFeedRequest, invoke: PublicFeedInvoker = invokeTauriCommand): Promise<PublicFeedResponse> {
  const normalized = normalizeFreeRequest(request);
  const raw = await invoke<PublicFeedResponse>('fetch_public_feed', { ...normalized });
  return validateResponse(raw, normalized);
}

export async function fetchFreeSerp(request: PublicFeedRequest, invoke: PublicFeedInvoker = invokeTauriCommand): Promise<FreeSerpFetchOutcome> {
  if (request.feed !== 'bing-serp') throw new Error('Free SERP transport supports Bing RSS only');
  const normalized = normalizeFreeRequest(request);
  const sourceUrl = publicFeedUrl(normalized);
  try {
    const response = await fetchPublicFeed(normalized, invoke);
    if (response.status !== 'ok') return { status: response.status, response, result: null };
    try {
      return { status: 'ok', response, result: parseBingSerpResponse(response, normalized) };
    } catch (error) {
      return { status: 'error', response: { ...response, status: 'error', body: null, error: messageOf(error) }, result: null };
    }
  } catch (error) {
    return { status: 'error', response: responseError(sourceUrl, error), result: null };
  }
}

export const FREE_SERP_PARTIAL_REASON = FREE_ENGINE_REASON;
