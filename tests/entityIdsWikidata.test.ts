import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from './fixtures/wikidataSearchEspresso.json';
import { entityGaps, linkEntity, lookupWikidata, parseWikidataSearch, type EntityLink } from '@/services/entityIds';
import { entityStoreKey, lookupKey, parseOverride, readEntityStore, writeEntityStore } from '@/services/entityIds/store';
import { publicFeedUrl, wikidataEntitiesFeedUrl } from '@/services/freeSerp/urls';

const body = JSON.stringify(fixture);
const okResponse = (sourceUrl: string) => ({ status: 'ok', sourceUrl, fetchedAt: '2026-10-30T00:00:00Z', body, httpStatus: 200, error: null });
beforeEach(() => localStorage.clear());

describe('Wikidata entity lookup (#99, #110)', () => {
  it('builds the fixed Wikidata URL with the primary language', () => {
    const url = new URL(wikidataEntitiesFeedUrl(' kawa ', 'pl', 'PL-pl'));
    expect(url.host).toBe('www.wikidata.org');
    expect(url.searchParams.get('language')).toBe('pl');
    expect(url.searchParams.get('search')).toBe('kawa');
    expect(publicFeedUrl({ feed: 'wikidata-entities', geo: 'PL', keyword: 'kawa', language: 'pl' })).toContain('wbsearchentities');
    expect(() => wikidataEntitiesFeedUrl('  ')).toThrow();
  });

  it('parses item IDs only, deduplicated, and rejects malformed JSON', () => {
    expect(parseWikidataSearch(body).map((item) => item.id)).toEqual(['Q181096', 'Q99999']);
    expect(() => parseWikidataSearch('{}')).toThrow();
    expect(parseWikidataSearch('{"search":[null,{"id":"Q1"}]}')).toEqual([{ id: 'Q1', label: '', description: '' }]);
  });

  it('goes through the native feed command and reports failures honestly', async () => {
    const invoke = vi.fn(async (_command: string, args?: Record<string, unknown>) => okResponse(wikidataEntitiesFeedUrl(String(args?.keyword), String(args?.geo), String(args?.language))));
    const ok = await lookupWikidata('espresso', 'en', 'US', invoke as never);
    expect(invoke).toHaveBeenCalledWith('fetch_public_feed', expect.objectContaining({ feed: 'wikidata-entities', keyword: 'espresso' }));
    expect(ok).toMatchObject({ status: 'ok', candidates: [{ id: 'Q181096' }, { id: 'Q99999' }] });
    const blocked = vi.fn(async (_c: string, args?: Record<string, unknown>) => ({ status: 'blocked', sourceUrl: wikidataEntitiesFeedUrl(String(args?.keyword), 'US', 'en'), fetchedAt: '2026-10-30T00:00:00Z', body: null, httpStatus: 429, error: 'rate limited' }));
    expect(await lookupWikidata('espresso', 'en', 'US', blocked as never)).toEqual({ status: 'blocked', candidates: [], error: 'rate limited' });
    expect(await lookupWikidata('espresso', 'en', 'US', vi.fn(async () => { throw new Error('offline'); }) as never)).toEqual({ status: 'error', candidates: [], error: 'offline' });
  });
});

describe('cross-language entity gaps', () => {
  const lookup = { status: 'ok' as const, candidates: parseWikidataSearch(body), fetchedAt: '2026-10-30T00:00:00Z' };
  it('prefers manual, then exact label, then first search hit', () => {
    expect(linkEntity({ language: 'pl', topic: 't', label: 'Espresso' }, lookup)).toMatchObject({ qid: 'Q181096', confidence: 'exact' });
    expect(linkEntity({ language: 'de', topic: 't', label: 'Espressokaffee' }, lookup)).toMatchObject({ qid: 'Q181096', confidence: 'search' });
    expect(linkEntity({ language: 'de', topic: 't', label: 'x' }, lookup, { 'de|t': null })).toMatchObject({ qid: null, confidence: 'manual' });
    expect(linkEntity({ language: 'de', topic: 't', label: 'x' }, undefined)).toMatchObject({ confidence: 'none' });
    expect(linkEntity({ language: 'de', topic: 't', label: 'x' }, { status: 'error', candidates: [], error: 'e' })).toMatchObject({ confidence: 'error' });
    expect(linkEntity({ language: 'de', topic: 't', label: 'x' }, { ...lookup, candidates: [] })).toMatchObject({ confidence: 'none' });
  });

  it('lists languages without the entity and marks unreviewed search matches', () => {
    const link = (language: string, qid: string | null, confidence: EntityLink['confidence']): EntityLink => ({ language, topic: `${language}-${qid}`, label: `l-${qid}`, qid, confidence });
    const gaps = entityGaps([link('pl', 'Q1', 'exact'), link('en', 'Q1', 'search'), link('pl', 'Q2', 'exact'), link('en', 'Q2', 'exact'), link('de', 'Q2', 'manual'), link('de', null, 'none')], ['de', 'en', 'pl']);
    expect(gaps).toEqual([{ qid: 'Q1', label: 'l-Q1', presentIn: ['en', 'pl'], missingIn: ['de'], reviewed: false }]);
  });
});

describe('entity store', () => {
  it('keeps manual corrections, expires lookups after 30 days and ignores bad data', () => {
    const now = Date.parse('2026-10-30T00:00:00Z');
    writeEntityStore('p1', { lookups: { [lookupKey('en', 'Espresso ')]: { status: 'ok', candidates: [], fetchedAt: '2026-09-01T00:00:00Z' }, 'en|tea': { status: 'error', candidates: [], error: 'x' } }, overrides: { 'en|t': 'Q5' } });
    const store = readEntityStore('p1', now);
    expect(Object.keys(store.lookups)).toEqual(['en|tea']);
    expect(store.overrides).toEqual({ 'en|t': 'Q5' });
    expect(readEntityStore(null)).toEqual({ lookups: {}, overrides: {} });
    localStorage.setItem(entityStoreKey('p2'), '{"lookups":5}');
    expect(readEntityStore('p2')).toEqual({ lookups: {}, overrides: {} });
  });

  it('parses manual input', () => {
    expect(parseOverride(' q42 ')).toBe('Q42');
    expect(parseOverride('none')).toBeNull();
    expect(parseOverride('')).toBeUndefined();
    expect(parseOverride('P31')).toBeUndefined();
  });
});
