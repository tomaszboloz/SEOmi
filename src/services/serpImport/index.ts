export * from './contracts';
import { parseSerpCsv } from './csv';
import { parseSerpJson } from './json';
export { parseSerpCsv, parseSerpJson };

export type SerpImportFormat = 'csv' | 'json';

export const parseSerpImport = (payload: string, format: SerpImportFormat) => format === 'csv' ? parseSerpCsv(payload) : parseSerpJson(payload);
