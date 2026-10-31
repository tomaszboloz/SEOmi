import { invokeTauriCommand } from '@/services/tauri';
import { fetchPublicFeed, type PublicFeedInvoker } from '@/services/publicFeedTransport';

/** One Wikidata item returned for a label search. */
export interface WikidataCandidate { id: string; label: string; description: string }

export type WikidataLookup =
  | { status: 'ok'; candidates: WikidataCandidate[]; fetchedAt: string }
  | { status: 'blocked' | 'error'; candidates: []; error: string };

const QID = /^Q[1-9]\d{0,11}$/;
const MAX_CANDIDATES = 5;
const text = (value: unknown): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

/** Parses `wbsearchentities` JSON; anything that is not a well-formed item ID is dropped. */
export const parseWikidataSearch = (body: string): WikidataCandidate[] => {
  const parsed = JSON.parse(body) as { search?: unknown };
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.search)) throw new Error('Wikidata response has no search list');
  const seen = new Set<string>();
  return parsed.search.flatMap((raw): WikidataCandidate[] => {
    const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const id = text(item.id);
    if (!QID.test(id) || seen.has(id)) return [];
    seen.add(id);
    return [{ id, label: text(item.label), description: text(item.description) }];
  }).slice(0, MAX_CANDIDATES);
};

/**
 * Looks a topic label up in Wikidata through the native public-feed command (the webview has no external hosts).
 * Failures are reported, never turned into an empty "no entity" answer.
 */
export const lookupWikidata = async (label: string, language: string, geo = 'US', invoke: PublicFeedInvoker = invokeTauriCommand): Promise<WikidataLookup> => {
  try {
    const response = await fetchPublicFeed({ feed: 'wikidata-entities', geo, keyword: label, language }, invoke);
    if (response.status !== 'ok') return { status: response.status, candidates: [], error: response.error ?? response.status };
    return { status: 'ok', candidates: parseWikidataSearch(response.body ?? ''), fetchedAt: response.fetchedAt };
  } catch (error) {
    return { status: 'error', candidates: [], error: error instanceof Error ? error.message : String(error) };
  }
};
