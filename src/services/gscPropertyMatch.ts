import type { GscSiteProperty } from '@/types';

const UNVERIFIED = 'siteUnverifiedUser';
const DOMAIN_PREFIX = 'sc-domain:';

const hostOf = (value: string | undefined): string | null => {
  if (!value?.trim()) return null;
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase().replace(/\.$/, '') || null;
  } catch {
    return null;
  }
};

const urlPrefixHost = (siteUrl: string): string | null => (siteUrl.startsWith(DOMAIN_PREFIX) ? null : hostOf(siteUrl));

/**
 * The Search Console property that covers a project's root URL, or null.
 * Domain properties win over URL-prefix ones because they include every
 * protocol and subdomain; `www` and the bare host count as the same site.
 * Properties without verified access return no data and are never matched.
 */
export const matchGscProperty = (properties: GscSiteProperty[], rootUrl: string | undefined): string | null => {
  const host = hostOf(rootUrl);
  if (!host) return null;
  const usable = properties.filter((property) => property.permissionLevel !== UNVERIFIED).map((property) => property.siteUrl);
  const alternate = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
  const names = [host, alternate];
  const exact = [DOMAIN_PREFIX, 'https://', 'http://'].flatMap((prefix) => names.map((name) => (prefix === DOMAIN_PREFIX ? `${prefix}${name}` : `${prefix}${name}/`)));
  const direct = exact.find((candidate) => usable.includes(candidate));
  if (direct) return direct;
  // A URL-prefix property that covers only a section of the site.
  const sameHost = usable.filter((siteUrl) => names.includes(urlPrefixHost(siteUrl) ?? ''));
  const root = rootUrl?.trim() ?? '';
  const covering = sameHost.filter((siteUrl) => root.startsWith(siteUrl.replace(/\/$/, ''))).sort((a, b) => b.length - a.length)[0];
  if (covering) return covering;
  // A domain property of a parent domain also covers this subdomain.
  const parent = usable
    .filter((siteUrl) => siteUrl.startsWith(DOMAIN_PREFIX) && host.endsWith(`.${siteUrl.slice(DOMAIN_PREFIX.length).toLowerCase()}`))
    .sort((a, b) => b.length - a.length)[0];
  return parent ?? null;
};

/**
 * Keep the property the project already uses; otherwise take the one that
 * matches the project's site. A project with a root URL and no matching
 * property selects nothing rather than an unrelated site; a project without a
 * root URL keeps the first property.
 */
export const selectGscProperty = (properties: GscSiteProperty[], storedProperty: string, rootUrl: string | undefined): string => {
  if (properties.some((property) => property.siteUrl === storedProperty)) return storedProperty;
  if (!hostOf(rootUrl)) return properties[0]?.siteUrl || '';
  return matchGscProperty(properties, rootUrl) ?? '';
};
