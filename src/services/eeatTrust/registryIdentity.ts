import type { EntityRole, ProfileEvidence } from './types';
import type { RegistryResponse } from './registry';
import { readRegistryRecord } from './registryRecords';

export interface RegistryIdentity {
  name: string;
  id?: string;
  role: EntityRole;
  aliases?: string[];
  profileUrls?: string[];
}
const nameKey = (value: string): string => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
const officialRecord = (profile: ProfileEvidence, response: RegistryResponse): boolean => {
  try {
    const url = new URL(response.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search) return false;
    return profile.kind === 'orcid'
      ? url.hostname === 'pub.orcid.org' && url.pathname === `/v3.0/${profile.id}`
      : profile.kind === 'wikidata' && ['www.wikidata.org', 'wikidata.org'].includes(url.hostname)
        && url.pathname === `/wiki/Special:EntityData/${profile.id}.json`;
  } catch { return false; }
};
const urlKey = (value: string, role: EntityRole): string | undefined => {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return undefined;
    if (role !== 'publisher' && url.pathname === '/') return undefined;
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString();
  } catch { return undefined; }
};

/** Corroborates an identifier/name/reciprocal URL, never credentials or support for an article's claims. */
export const createRegistryMatcher = (entity: RegistryIdentity) => {
  const names = new Set([entity.name, ...(entity.aliases ?? [])].map(nameKey).filter(Boolean));
  const urls = new Set([entity.id, ...(entity.profileUrls ?? [])]
    .flatMap((value) => value ? [urlKey(value, entity.role)].filter((url): url is string => Boolean(url)) : []));
  return (profile: ProfileEvidence, response: RegistryResponse): boolean | undefined => {
    if (!officialRecord(profile, response)) return undefined;
    const record = readRegistryRecord(profile, response.body);
    if (!record || !profile.id) return undefined;
    if (record.id !== profile.id) return false;
    const sameName = record.names.some((name) => names.has(nameKey(name)));
    const reciprocal = record.urls.some((url) => { const key = urlKey(url, entity.role); return key !== undefined && urls.has(key); });
    return sameName && reciprocal ? true : undefined;
  };
};

