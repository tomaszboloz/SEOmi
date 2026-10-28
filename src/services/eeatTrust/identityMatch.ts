import type { ProfileEvidence } from './types';

const HONORIFICS = new Set(['dr', 'prof', 'mgr', 'inz', 'lic', 'md', 'phd', 'hab', 'mr', 'mrs', 'ms', 'dott', 'herr', 'frau']);
const LETTERS: Record<string, string> = { 'ł': 'l', 'ø': 'o', 'đ': 'd', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ð': 'd', 'þ': 'th', 'ı': 'i' };
const NAME_KEYS = /^(labels|aliases|other-names|name|alternateName)$/;

/** Unicode-safe comparison tokens: accents and case folded, punctuation dropped, honorifics ignored. */
export const nameTokens = (value: string): string[] => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[łøđßæœðþı]/g, (char) => LETTERS[char] ?? char)
  .split(/[^\p{L}\p{N}]+/u).filter((token) => token && !HONORIFICS.has(token));

/** Same person name: equal token sets (any order, "Nowak, Anna"), or the smaller (>=2 tokens) is a subset (middle names). */
export const sameName = (a: string, b: string): boolean => {
  const left = new Set(nameTokens(a));
  const right = new Set(nameTokens(b));
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  return small.size >= 2 && [...small].every((token) => large.has(token));
};

const decode = (text: string): string => text.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code))).replace(/\s+/g, ' ').trim();

const strings = (value: unknown, out: string[], depth = 0): void => {
  if (depth > 6 || value === null) return;
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'object') Object.values(value as object).forEach((child) => strings(child, out, depth + 1));
};

const jsonNames = (value: unknown, out: string[], depth = 0): void => {
  if (depth > 8 || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((item) => jsonNames(item, out, depth + 1)); return; }
  const record = value as Record<string, unknown>;
  const given = (record['given-names'] as { value?: unknown } | null | undefined)?.value;
  const family = (record['family-name'] as { value?: unknown } | null | undefined)?.value;
  if (typeof given === 'string' && typeof family === 'string') out.push(`${given} ${family}`);
  for (const [key, child] of Object.entries(record)) {
    // ORCID `name` is an object whose given and family parts are joined above, not listed as separate names.
    if (NAME_KEYS.test(key) && !(key === 'name' && child && typeof child === 'object')) strings(child, out); else jsonNames(child, out, depth + 1);
  }
};

const htmlNames = (html: string): string[] => {
  const out: string[] = [];
  for (const match of html.matchAll(/<(title|h1)\b[^>]*>([\s\S]*?)<\/\1>/gi)) out.push(decode(match[2]).replace(/\s*[-|(].*$/, ''));
  for (const match of html.matchAll(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/gi)) out.push(decode(match[1]));
  for (const match of html.matchAll(/"(?:name|alternateName)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) out.push(decode(match[1].replace(/\\"/g, '"')));
  return out;
};

/** Names a registry body claims for its subject; empty when the body names no one or several profiles. */
export const bodyNames = (body: string): string[] => {
  const out: string[] = [];
  try {
    const parsed: unknown = JSON.parse(body);
    const entities = (parsed as { entities?: object } | null)?.entities;
    if (entities && Object.keys(entities).length > 1) return [];
    jsonNames(parsed, out);
  } catch { out.push(...htmlNames(body)); }
  return [...new Set(out.map((name) => name.trim()).filter(Boolean))];
};

/**
 * Default identity matcher for ORCID and Wikidata (#87). Compares declared name and aliases with the
 * names in the registry body. true = a name agrees; false = body names someone and nobody agrees;
 * undefined = cannot decide (no subject, one-word name, other registry, empty or ambiguous body).
 * A name match is weak evidence: homonyms exist, and it never certifies qualifications.
 */
export const defaultIdentityMatcher = (profile: ProfileEvidence, response: { body: string }): boolean | undefined => {
  if (profile.kind !== 'orcid' && profile.kind !== 'wikidata') return undefined;
  const subjects = (profile.subjects ?? []).filter((name) => nameTokens(name).length >= 2);
  if (!subjects.length) return undefined;
  const names = bodyNames(response.body);
  if (!names.length) return undefined;
  return subjects.some((subject) => names.some((name) => sameName(subject, name)));
};
