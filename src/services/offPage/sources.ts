import { getDomain } from 'tldts';
import type { BacklinkProfileData } from '@/types';
import type { Vector } from '@/services/embeddings/types';

export type BodyAvailability = 'ok' | 'unavailable' | 'too-large' | 'blocked';
export interface SourceEvidence {
  sourceUrl: string;
  authority: number | null;
  fetchedAt: string | null;
  availability: BodyAvailability | null;
  text: string;
  vector: Vector | null;
}
export interface SourceAnalysis {
  sources: SourceEvidence[];
  topic: Vector | null;
  coreEntity: string;
  aliases: string[];
}
export const SOURCE_LIMIT = 25;
export const SOURCE_TEXT_LIMIT = 20_000;
export const usableVector = (vector: Vector | null | undefined): vector is Vector =>
  !!vector?.length && vector.every(Number.isFinite) && vector.some((value) => value !== 0);

export const sourceDomain = (value: string): string => {
  try {
    const hostname = new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase();
    return getDomain(hostname, { allowPrivateDomains: true }) ?? hostname.replace(/^www\./u, '');
  } catch { return value.toLowerCase(); }
};

export const selectSources = (profile: BacklinkProfileData): SourceEvidence[] => {
  const seen = new Set<string>();
  return profile.backlinks.filter((link) => link.is_dofollow)
    .map((link) => ({ sourceUrl: link.source_url, authority: Number.isFinite(link.domain_rank) ? link.domain_rank : null }))
    .sort((left, right) => (right.authority ?? -Infinity) - (left.authority ?? -Infinity))
    .filter((link) => {
      const domain = sourceDomain(link.sourceUrl);
      if (seen.has(domain)) return false;
      seen.add(domain);
      return true;
    }).slice(0, SOURCE_LIMIT)
    .map((link) => ({ ...link, fetchedAt: null, availability: null, text: '', vector: null }));
};

export const brandAliases = (domain: string, name?: string): string[] => {
  const host = sourceDomain(domain);
  return [...new Set([name?.trim(), host, host.split('.')[0]].filter((value): value is string => !!value))];
};
