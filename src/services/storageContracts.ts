import { z } from 'zod';
import { readJsonStorage } from './storage';

/** A typed record of unknown values is a first guard, never a domain contract. */
export const parseJsonRecord = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    Object.defineProperty(record, key, { value: entry, enumerable: true, configurable: true, writable: true });
  }
  return record;
};

export const readJsonRecord = (key: string): Record<string, unknown> => parseJsonRecord(readJsonStorage(key, null));

export const parseRecordEntries = <T>(value: unknown, schema: z.ZodType<T, z.ZodTypeDef, unknown>, limit = 500): Record<string, T> => {
  const record: Record<string, T> = {};
  for (const [key, entry] of Object.entries(parseJsonRecord(value)).slice(-limit)) {
    const result = schema.safeParse(entry);
    if (result.success) Object.defineProperty(record, key, { value: result.data, enumerable: true, configurable: true, writable: true });
  }
  return record;
};
