import type { ProfileEvidence, ProfileKind } from './types';

const ORCID_PATH = /^\/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])\/?$/;
const WIKIDATA_PATH = /^\/(?:wiki|entity)\/(Q[1-9]\d*)\/?$/;
const LINKEDIN_PROFILE = /^\/in\/[^/]+/i;

/** Tier weights from the reference profile in issue #87 (a declaration signal, not a certificate). */
export const TIER_WEIGHTS = { 1: 0.45, 2: 0.25, 3: 0.08 } as const;

const NETWORKS: Array<[string, ProfileKind, 2 | 3]> = [
  ['scholar.google.com', 'register', 2], ['researchgate.net', 'register', 2], ['scopus.com', 'register', 2],
  ['linkedin.com', 'social', 3], ['x.com', 'social', 3], ['twitter.com', 'social', 3],
  ['facebook.com', 'social', 3], ['instagram.com', 'social', 3], ['youtube.com', 'social', 3],
];

/** Host equals the domain or is a true subdomain; `evilorcid.org` and `orcid.org.evil.test` never match. */
export const hostMatches = (host: string, domain: string): boolean => host === domain || host.endsWith(`.${domain}`);

/** ISO 7064 mod 11-2 checksum over the 16 ORCID characters. */
export const orcidChecksumValid = (orcid: string): boolean => {
  const digits = orcid.replace(/-/g, '');
  if (!/^\d{15}[\dX]$/.test(digits)) return false;
  const total = [...digits.slice(0, 15)].reduce((sum, char) => (sum + Number(char)) * 2, 0);
  const check = (12 - (total % 11)) % 11;
  return digits[15] === (check === 10 ? 'X' : String(check));
};

const parse = (value: string): URL | null => {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch { return null; }
};

/** Syntax-only classification of one sameAs URL. Nothing is fetched, so status is never "verified". */
export const classifyProfile = (value: string): ProfileEvidence => {
  const url = parse(value);
  const base = { url: value.trim() };
  if (!url) return { ...base, kind: 'other', status: 'invalid' };
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (hostMatches(host, 'orcid.org')) {
    const id = ORCID_PATH.exec(url.pathname)?.[1];
    return { ...base, kind: 'orcid', tier: 1, id, status: id && orcidChecksumValid(id) ? 'syntax-valid' : 'invalid' };
  }
  if (hostMatches(host, 'wikidata.org')) {
    const id = WIKIDATA_PATH.exec(url.pathname)?.[1];
    return { ...base, kind: 'wikidata', tier: 1, id, status: id ? 'syntax-valid' : 'invalid' };
  }
  const network = NETWORKS.find(([domain]) => hostMatches(host, domain));
  if (!network) return { ...base, kind: 'other', status: 'declared' };
  const isProfile = network[0] === 'linkedin.com' ? LINKEDIN_PROFILE.test(url.pathname) : url.pathname.length > 1;
  return { ...base, kind: network[1], tier: network[2], status: isProfile ? 'syntax-valid' : 'declared' };
};

const dedupeKey = (profile: ProfileEvidence): string => `${profile.kind}:${(profile.id ?? profile.url).toLowerCase().replace(/\/+$/, '')}`;

/** Unique profiles; the same ORCID or Q-ID written as two URLs counts once. */
export const classifyProfiles = (urls: string[]): ProfileEvidence[] => {
  const seen = new Map<string, ProfileEvidence>();
  urls.filter((url) => url.trim()).forEach((url) => {
    const profile = classifyProfile(url);
    const key = dedupeKey(profile);
    if (!seen.has(key)) seen.set(key, profile);
  });
  return [...seen.values()];
};

/** Rec(E) = min(1, sum of tier weight over syntax-valid profiles): a declaration indicator. */
export const declarationRecall = (profiles: ProfileEvidence[]): number =>
  Math.min(1, profiles.reduce((sum, profile) => sum + (profile.status === 'syntax-valid' && profile.tier ? TIER_WEIGHTS[profile.tier] : 0), 0));
