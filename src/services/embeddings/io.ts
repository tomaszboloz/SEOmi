import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import type { EmbeddingProvider, Vector } from './types.ts';

export interface InputText {
  id: string;
  text: string;
}

const MAX_TEXT_CHARS = 8_000;

const toInput = (value: unknown, index: number): InputText | null => {
  if (typeof value === 'string') return value.trim() ? { id: String(index + 1), text: value.trim().slice(0, MAX_TEXT_CHARS) } : null;
  const record = value as { id?: unknown; text?: unknown };
  if (typeof record?.text !== 'string' || !record.text.trim()) return null;
  return { id: record.id === undefined ? String(index + 1) : String(record.id), text: record.text.trim().slice(0, MAX_TEXT_CHARS) };
};

/** Parses .json (array of strings or {id,text}), .jsonl, or one text per line (.txt/.csv first column). */
export const parseInputs = (content: string, format: string): InputText[] => {
  const extension = format.toLowerCase().replace(/^\./, '');
  let values: unknown[];
  if (extension === 'json') {
    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed)) throw new Error('JSON input must be an array');
    values = parsed;
  } else if (extension === 'jsonl') {
    values = content.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line) as unknown);
  } else {
    values = content.split(/\r?\n/).map((line) => (extension === 'csv' ? line.split(/[,;\t]/)[0].replace(/^"|"$/g, '') : line));
  }
  return values.map(toInput).filter((item): item is InputText => item !== null);
};

export const readInputs = (path: string): InputText[] => parseInputs(readFileSync(path, 'utf8'), extname(path) || 'txt');

const cacheKey = (provider: EmbeddingProvider, text: string): string =>
  createHash('sha256').update(`${provider.id}\u0000${provider.model}\u0000${text}`).digest('hex');

/**
 * Wraps a provider with a JSON file cache, so re-running on a grown keyword
 * list only embeds new texts. Entries are keyed by provider, model and text.
 */
export const withFileCache = (provider: EmbeddingProvider, path: string): EmbeddingProvider & { save(): void } => {
  const cache = new Map<string, number[]>(existsSync(path) ? Object.entries(JSON.parse(readFileSync(path, 'utf8')) as Record<string, number[]>) : []);
  return {
    id: provider.id,
    model: provider.model,
    async embed(texts: string[]) {
      const missing = [...new Set(texts.filter((text) => !cache.has(cacheKey(provider, text))))];
      const fresh = missing.length ? await provider.embed(missing) : [];
      missing.forEach((text, index) => cache.set(cacheKey(provider, text), Array.from(fresh[index])));
      return texts.map((text): Vector => Float64Array.from(cache.get(cacheKey(provider, text)) ?? []));
    },
    save() {
      writeFileSync(path, JSON.stringify(Object.fromEntries(cache)));
    },
  };
};
