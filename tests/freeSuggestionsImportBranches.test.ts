import { describe, expect, it } from 'vitest';
import { importSuggestions } from '@/services/freeSuggestions';
import { parseGoogleSuggestions, parseGoogleSuggestionsResponse } from '@/services/freeSuggestions/parser';

const importedAt = '2026-10-10T10:00:00Z';

describe('suggestion import edge cases and provenance', () => {
  it('preserves escaped quotes, skips empty CSV cells and accepts CR-only rows', () => {
    const result = importSuggestions({
      format: 'csv', payload: ',\r"seo ""tools""",,\n audit \r\n', importedAt,
    });
    expect(result.suggestions).toEqual(['seo "tools"', 'audit']);
    expect(result.query).toBeNull();
    expect(result.source).toMatchObject({ sourceUrl: null, requestedGeo: null, requestedLanguage: null });
  });

  it('uses explicit query and source instead of envelope metadata', () => {
    const result = importSuggestions({
      format: 'json', payload: JSON.stringify({ query: 'ignored', sourceUrl: 'https://ignored.test', suggestions: ['one'] }),
      query: ' selected ', sourceUrl: 'https://chosen.test/path', importedAt,
    });
    expect(result.query).toBe('selected');
    expect(result.source.sourceUrl).toBe('https://chosen.test/path');
  });

  it.each(['null', 'true', '42', '"text"'])('rejects a scalar JSON document: %s', (payload) => {
    expect(() => importSuggestions({ format: 'json', payload, importedAt })).toThrow(/array or object/);
  });

  it.each(['{', '[null]', '[42]', '[""]', JSON.stringify(['x'.repeat(501)])])('rejects malformed suggestions: %s', (payload) => {
    expect(() => importSuggestions({ format: 'json', payload, importedAt })).toThrow(/invalid/);
  });

  it.each(['https://user@source.test', 'https://user:password@source.test'])('rejects URL credentials: %s', (sourceUrl) => {
    expect(() => importSuggestions({ format: 'json', payload: '["one"]', sourceUrl, importedAt })).toThrow(/source URL/);
  });

  it('handles response errors and default timestamps in parseGoogleSuggestions', () => {
    const request = { feed: 'google-suggestions' as const, geo: 'PL', keyword: 'seo', language: 'pl' };
    const validEcho = JSON.stringify(['seo', ['seo tool']]);
    const defaultParsed = parseGoogleSuggestions(validEcho, request);
    expect(defaultParsed.suggestions).toEqual(['seo tool']);
    expect(defaultParsed.fetchedAt).toBeTruthy();

    expect(() => parseGoogleSuggestionsResponse({
      status: 'error', sourceUrl: 'https://suggestqueries.google.com/complete/search?client=chrome&hl=pl&gl=pl&q=seo',
      fetchedAt: importedAt, body: null, httpStatus: 500, error: null,
    }, request)).toThrow('Google Suggestions response is unavailable');

    expect(() => parseGoogleSuggestionsResponse({
      status: 'error', sourceUrl: 'https://suggestqueries.google.com/complete/search?client=chrome&hl=pl&gl=pl&q=seo',
      fetchedAt: importedAt, body: null, httpStatus: 500, error: 'Custom failure message',
    }, request)).toThrow('Custom failure message');

    expect(() => parseGoogleSuggestionsResponse({
      status: 'ok', sourceUrl: 'https://suggestqueries.google.com/complete/search?client=chrome&hl=pl&gl=pl&q=seo',
      fetchedAt: importedAt, body: null, httpStatus: 200, error: null,
    }, request)).toThrow('Google Suggestions response is unavailable');
  });
});
