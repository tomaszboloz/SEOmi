import { createId } from '@/services/ids';
export const MAX_NODES = 300;
export const MAX_FACTS = 300;
export const MAX_QUERIES_PER_NODE = 100;
export const MAX_URLS_PER_NODE = 1000;
export const MAX_TERMS_PER_NODE = 80;
export const MAX_BRIEF_ENTITIES = 80;
export const MAX_BRIEF_LINKS = 50;
export const MAX_BRIEF_VERSIONS = 30;

export const id = () => createId('topic');
export const cleanText = (value: unknown, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
export const oneOf = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;
export const validHttpUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href.slice(0, 2048) : null;
  } catch { return null; }
};
