import type { SerpImportResult } from './contracts';
import { assertSerpPayload, buildSerpImport } from './normalize';

const normalizeHeader = (value: string): string => value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_-]+/g, '');
const aliases: Record<string, string[]> = {
  keyword: ['keyword', 'query', 'phrase'], rank: ['rank', 'position'], url: ['url', 'link'], provider: ['provider', 'sourceprovider', 'source'],
  sourceUrl: ['sourceurl', 'sourceuri'], countryCode: ['country', 'countrycode', 'market'], locationCode: ['location', 'locationcode'],
  languageCode: ['language', 'languagecode', 'lang'], capturedAt: ['capturedat', 'captured', 'timestamp'], retrievedAt: ['retrievedat', 'retrieved'],
  availability: ['availability', 'status'], reason: ['reason', 'statusreason'],
};

const rows = (payload: string): string[][] => {
  const result: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false; let closed = false;
  const finish = () => { row.push(cell.trim()); if (row.some(Boolean)) result.push(row); row = []; cell = ''; closed = false; };
  const text = payload.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) { if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (char === '"') { quoted = false; closed = true; } else cell += char; }
    else if (char === '"' && cell === '' && !closed) quoted = true;
    else if (char === ',') { row.push(cell.trim()); cell = ''; closed = false; }
    else if (char === '\n' || char === '\r') { finish(); if (char === '\r' && text[i + 1] === '\n') i += 1; }
    else if (closed || char === '"') throw new Error('Invalid SERP CSV quoting');
    else { cell += char; }
  }
  if (quoted) throw new Error('Unclosed SERP CSV quote');
  if (cell || row.length) finish();
  return result;
};

const columns = (header: string[]): Record<string, number> => {
  const normalized = header.map(normalizeHeader); const result: Record<string, number> = {};
  for (const [name, names] of Object.entries(aliases)) {
    const found = normalized.flatMap((value, index) => names.includes(value) ? [index] : []);
    if (found.length > 1) throw new Error(`Ambiguous SERP CSV ${name} column`);
    if (found.length) result[name] = found[0];
  }
  for (const required of ['keyword', 'rank', 'url']) if (result[required] === undefined) throw new Error(`SERP CSV ${required} column is missing`);
  return result;
};

const metadata = (row: string[], column: Record<string, number>): Record<string, string> => Object.fromEntries(
  ['provider', 'sourceUrl', 'countryCode', 'locationCode', 'languageCode', 'capturedAt', 'retrievedAt', 'availability', 'reason']
    .flatMap((name) => column[name] !== undefined && row[column[name]] ? [[name, row[column[name]]] as [string, string]] : []),
);

const mergeMetadata = (current: Record<string, string>, next: Record<string, string>): Record<string, string> => {
  for (const [key, value] of Object.entries(next)) if (current[key] && current[key] !== value) throw new Error(`Conflicting SERP CSV ${key} metadata`);
  return { ...current, ...next };
};

export const parseSerpCsv = (payload: string): SerpImportResult => {
  assertSerpPayload(payload);
  const parsed = rows(payload);
  if (!parsed.length) throw new Error('SERP CSV header is missing');
  const column = columns(parsed[0]); const records: unknown[] = []; const rejected: Array<{ row: number; reason: string }> = [];
  let source: Record<string, string> = {};
  parsed.slice(1).forEach((row, index) => {
    try {
      source = mergeMetadata(source, metadata(row, column));
      records.push({ keyword: row[column.keyword], rank: row[column.rank], url: row[column.url] });
    } catch (error) { rejected.push({ row: index + 2, reason: String(error).replace(/^Error:\s*/, '') }); }
  });
  return buildSerpImport('csv-import', records, source, rejected);
};
