import type { SavedKeywordProvenance } from '@/types';
import { assertSerpPayload } from '../serpImport/normalize';

export const MAX_SUGGESTIONS_IMPORT_RECORDS = 100;
export type SuggestionsImportFormat = 'json' | 'csv';

export interface ImportedSuggestionsResult {
  feed: 'google-suggestions-import';
  query: string | null;
  suggestions: string[];
  importedAt: string;
  source: Extract<SavedKeywordProvenance, { kind: 'user-import' }>;
}

interface ImportOptions {
  format: SuggestionsImportFormat;
  payload: string;
  query?: string;
  geo?: string;
  language?: string;
  sourceUrl?: string;
  importedAt?: string;
}

const cellRows = (payload: string): string[] => {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < payload.length; index += 1) {
    const character = payload[index];
    if (character === '"') {
      if (quoted && payload[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if ((character === ',' || character === '\n' || character === '\r') && !quoted) {
      if (value.trim()) values.push(value.trim());
      value = '';
      if (character === '\r' && payload[index + 1] === '\n') index += 1;
    } else value += character;
  }
  if (value.trim()) values.push(value.trim());
  return values;
};

const text = (value: unknown): string => typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : '';
const sourceUrl = (value: unknown): string | null => {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new URL(raw);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Imported source URL is invalid');
  return parsed.toString();
};
const locale = (value: unknown, pattern: RegExp): string | null => {
  const raw = text(value);
  if (!raw) return null;
  if (!pattern.test(raw)) throw new Error('Imported locale context is invalid');
  return raw;
};

const parseValues = (format: SuggestionsImportFormat, payload: string): { values: unknown[]; query?: unknown; sourceUrl?: unknown } => {
  assertSerpPayload(payload);
  if (format === 'csv') return { values: cellRows(payload) };
  let parsed: unknown;
  try { parsed = JSON.parse(payload); } catch { throw new Error('Imported suggestions JSON is invalid'); }
  if (Array.isArray(parsed)) return { values: parsed };
  if (!parsed || typeof parsed !== 'object') throw new Error('Imported suggestions JSON must be an array or object');
  const record = parsed as Record<string, unknown>;
  return { values: record.suggestions as unknown[], query: record.query, sourceUrl: record.sourceUrl };
};

export const importSuggestions = (options: ImportOptions): ImportedSuggestionsResult => {
  const importedAt = options.importedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(importedAt))) throw new Error('Imported suggestions timestamp is invalid');
  const parsed = parseValues(options.format, options.payload);
  if (!Array.isArray(parsed.values) || parsed.values.length > MAX_SUGGESTIONS_IMPORT_RECORDS) throw new Error('Imported suggestions record limit exceeded');
  const unique = new Map<string, string>();
  parsed.values.forEach((value) => {
    const suggestion = text(value);
    if (!suggestion || suggestion.length > 500) throw new Error('Imported suggestion is invalid');
    const key = suggestion.toLocaleLowerCase();
    if (!unique.has(key)) unique.set(key, suggestion);
  });
  const requestedGeo = locale(options.geo, /^[A-Za-z]{2}$/);
  const requestedLanguage = locale(options.language, /^[A-Za-z]{2,8}(?:-[A-Za-z]{2,8})?$/);
  const source = sourceUrl(options.sourceUrl ?? parsed.sourceUrl);
  return {
    feed: 'google-suggestions-import', query: text(options.query) || (text(parsed.query) || null), suggestions: [...unique.values()], importedAt,
    source: { kind: 'user-import', provider: 'User supplied file', sourceUrl: source, requestedGeo: requestedGeo?.toUpperCase() ?? null, requestedLanguage: requestedLanguage?.toLowerCase() ?? null, retrievedAt: importedAt, availability: 'user-supplied', reason: 'Imported locally by the user' },
  };
};
