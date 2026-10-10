import { parseSerpImport, type SerpImportFormat, type SerpImportResult } from '@/services/serpImport';
import { readJsonStorage, removeStorage, writeJsonStorage } from '@/services/storage';

export interface ImportedSerp {
  payload: string;
  format: SerpImportFormat;
  importedAt: string;
  result: SerpImportResult;
}

const key = (projectId: string) => `seomi_project_${projectId}_imported_serp_v1`;

export const readImportedSerp = (projectId: string | null): ImportedSerp | null => {
  if (!projectId) return null;
  const raw = readJsonStorage(key(projectId), null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.payload !== 'string' || !['csv', 'json'].includes(String(value.format))
    || typeof value.importedAt !== 'string' || !Number.isFinite(Date.parse(value.importedAt))) return null;
  try {
    const format = value.format as SerpImportFormat;
    return { payload: value.payload, format, importedAt: value.importedAt, result: parseSerpImport(value.payload, format) };
  } catch { return null; }
};

export const saveImportedSerp = (projectId: string, payload: string, format: SerpImportFormat, importedAt: string): ImportedSerp => {
  if (!projectId || !Number.isFinite(Date.parse(importedAt))) throw new Error('Invalid SERP import scope or timestamp');
  const result = parseSerpImport(payload, format);
  if (!writeJsonStorage(key(projectId), { payload, format, importedAt })) throw new Error('SERP import storage is unavailable');
  return { payload, format, importedAt, result };
};

export const clearImportedSerp = (projectId: string): boolean => Boolean(projectId) && removeStorage(key(projectId));
