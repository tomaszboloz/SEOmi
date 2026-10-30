import { brandKeys, phraseKey } from './terms';
import type { BrandFilterReason, BrandFilterReport, BrandPolicyInput } from './types';

export const MAX_BRAND_TERMS = 30;
export const MAX_BRAND_TERM_LENGTH = 60;

/**
 * Brand exclusion policy (#56). Decision (default chosen by agent, GEM-56-01): keep the 0.3.0 rule that
 * the site's own domain name is not a topic, and add an explicit per-project dictionary on top of it:
 * own-brand aliases are excluded like the domain, competitor brands are never reported as gaps, and
 * exceptions keep a brand-looking word that is a real industry term (e.g. a domain named after the product).
 */
export interface BrandPolicy {
  /** Own brand keys (domain parts and aliases) with the reason each is excluded. */
  own: Map<string, Extract<BrandFilterReason, 'own-domain' | 'own-alias'>>;
  competitors: Set<string>;
  exceptions: Set<string>;
  input: BrandPolicyInput;
}

/** Trimmed, de-duplicated, length-capped list; anything else is dropped, not repaired. */
export const cleanBrandList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const items = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim().replace(/\s+/g, ' '))
    .filter((item) => item.length > 0 && item.length <= MAX_BRAND_TERM_LENGTH);
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.toLowerCase()) && !!seen.add(item.toLowerCase())).slice(0, MAX_BRAND_TERMS);
};

const keysOf = (terms: string[], language: string): string[] =>
  terms.map((term) => phraseKey(term, language)).filter((key): key is string => !!key);

export const resolveBrandPolicy = (startUrl: string, language: string, input: BrandPolicyInput = {}): BrandPolicy => {
  const clean = { aliases: cleanBrandList(input.aliases), competitors: cleanBrandList(input.competitors), exceptions: cleanBrandList(input.exceptions) };
  const exceptions = new Set(keysOf(clean.exceptions, language));
  const own = new Map<string, 'own-domain' | 'own-alias'>();
  brandKeys(startUrl, language).forEach((key) => { if (!exceptions.has(key)) own.set(key, 'own-domain'); });
  keysOf(clean.aliases, language).forEach((key) => { if (!exceptions.has(key) && !own.has(key)) own.set(key, 'own-alias'); });
  const competitors = new Set(keysOf(clean.competitors, language).filter((key) => !exceptions.has(key) && !own.has(key)));
  const cleaned: BrandPolicyInput = Object.fromEntries(Object.entries(clean).filter(([, list]) => list.length));
  return { own, competitors, exceptions, input: cleaned };
};

/** True when the brand phrase occurs as consecutive words of the term key. */
const contains = (key: string, brand: string): boolean => {
  const words = key.split(' ');
  const parts = brand.split(' ');
  for (let start = 0; start + parts.length <= words.length; start += 1) {
    if (parts.every((part, index) => words[start + index] === part)) return true;
  }
  return false;
};

/** Reason a term key is brand noise, or undefined when it stays (exceptions always stay). */
export const brandReason = (key: string, policy: BrandPolicy): BrandFilterReason | undefined => {
  if (policy.exceptions.has(key)) return undefined;
  for (const [brand, reason] of policy.own) if (contains(key, brand)) return reason;
  for (const brand of policy.competitors) if (contains(key, brand)) return 'competitor-brand';
  return undefined;
};

/** Own-brand matcher for page terms; competitor names stay in page text (they may be compared on purpose). */
export const ownBrandMatcher = (policy: BrandPolicy) => (key: string): boolean => {
  const reason = brandReason(key, policy);
  return reason === 'own-domain' || reason === 'own-alias';
};

export const describeBrandFilter = (
  policy: BrandPolicy, filteredGaps: BrandFilterReport['filteredGaps'],
): BrandFilterReport => ({
  ownBrand: [...policy.own.keys()].sort(), exceptions: [...policy.exceptions].sort(), filteredGaps,
});
