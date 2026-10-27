import { describe, expect, it } from 'vitest';
import { importSuggestions, MAX_SUGGESTIONS_IMPORT_RECORDS } from '@/services/freeSuggestions';

describe('Google Suggestions import contracts', () => {
  it('imports JSON envelopes, keeps the first duplicate and records provenance', () => {
    const result = importSuggestions({
      format: 'json',
      payload: JSON.stringify({ query: 'seo', suggestions: [' SEO audit ', 'seo AUDIT', 'seo tools'], sourceUrl: 'https://export.example.test/list' }),
      geo: 'pl', language: 'PL-pl', importedAt: '2026-10-06T10:00:00Z',
    });
    expect(result.suggestions).toEqual(['SEO audit', 'seo tools']);
    expect(result.query).toBe('seo');
    expect(result.source).toMatchObject({ kind: 'user-import', sourceUrl: 'https://export.example.test/list', requestedGeo: 'PL', requestedLanguage: 'pl-pl', availability: 'user-supplied', retrievedAt: result.importedAt });
  });

  it('parses quoted CSV cells and applies explicit options over JSON metadata', () => {
    const result = importSuggestions({
      format: 'csv', payload: 'seo, "seo, tools"\r\n"seo, tools"', query: '  selected  ', geo: 'DE', language: 'de', sourceUrl: 'https://source.example.test', importedAt: '2026-10-06T10:00:00Z',
    });
    expect(result.query).toBe('selected');
    expect(result.suggestions).toEqual(['seo', 'seo, tools']);
    expect(result.source.sourceUrl).toBe('https://source.example.test/');
  });

  it('enforces byte and record limits before accepting an import', () => {
    expect(() => importSuggestions({ format: 'json', payload: 'x'.repeat(1_048_577) })).toThrow(/byte limit/);
    expect(() => importSuggestions({ format: 'json', payload: JSON.stringify(Array.from({ length: MAX_SUGGESTIONS_IMPORT_RECORDS + 1 }, (_, index) => `idea ${index}`)) })).toThrow(/record limit/);
  });

  it('rejects malformed metadata and timestamps', () => {
    expect(() => importSuggestions({ format: 'json', payload: '[]', geo: 'POL' })).toThrow(/locale/);
    expect(() => importSuggestions({ format: 'json', payload: '[]', language: 'p' })).toThrow(/locale/);
    expect(() => importSuggestions({ format: 'json', payload: '[]', sourceUrl: 'ftp://source.example.test' })).toThrow(/source URL/);
    expect(() => importSuggestions({ format: 'json', payload: '[]', importedAt: 'yesterday' })).toThrow(/timestamp/);
  });
});
