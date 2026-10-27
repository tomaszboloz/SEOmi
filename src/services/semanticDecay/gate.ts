import type { Incompatibility, SerpSnapshot } from './types';

const FIELDS: Incompatibility[] = ['query', 'country', 'language', 'provider', 'model', 'profile', 'k'];

const norm = (value: string | number): string => String(value).normalize('NFKC').trim().toLocaleLowerCase();

/** Fields that differ. A model or source change is incompatible, never a market change. */
export const incompatibilities = (a: SerpSnapshot, b: SerpSnapshot): Incompatibility[] =>
  FIELDS.filter((field) => norm(a[field]) !== norm(b[field]));
