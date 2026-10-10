import { parse } from 'tldts';
import type { GscSiteProperty } from '@/types';

const UNVERIFIED = 'siteUnverifiedUser';
const DOMAIN_PREFIX = 'sc-domain:';
type Root = { host: string; protocol: string; port: string | null; pathname: string };

const rootOf = (value: string | undefined): Root | null => {
  if (!value?.trim()) return null;
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return null;
    return { host: parsed.hostname.toLowerCase().replace(/\.$/, ''), protocol: parsed.protocol, port: parsed.port || null, pathname: parsed.pathname || '/' };
  } catch {
    return null;
  }
};

const domainOf = (siteUrl: string): string | null => {
  if (siteUrl.slice(0, DOMAIN_PREFIX.length).toLowerCase() !== DOMAIN_PREFIX) return null;
  const domain = siteUrl.slice(DOMAIN_PREFIX.length).toLowerCase().replace(/\.$/, '');
  try {
    const parsedUrl = new URL(`https://${domain}`);
    if (parsedUrl.hostname !== domain || parsedUrl.username || parsedUrl.password || parsedUrl.port || parsedUrl.pathname !== '/') return null;
  } catch {
    return null;
  }
  const parsed = parse(domain, { allowPrivateDomains: true });
  return parsed.domain && !parsed.isIp ? domain : null;
};

const verified = (property: GscSiteProperty): boolean => property.permissionLevel !== UNVERIFIED;
const domainNames = (host: string): string[] => host.startsWith('www.') ? [host, host.slice(4)] : [host];

const prefixCovers = (siteUrl: string, root: Root): boolean => {
  if (siteUrl.slice(0, DOMAIN_PREFIX.length).toLowerCase() === DOMAIN_PREFIX) return false;
  try {
    const prefix = new URL(siteUrl);
    if (prefix.username || prefix.password || prefix.protocol !== root.protocol || (prefix.port || null) !== root.port || prefix.hostname.toLowerCase().replace(/\.$/, '') !== root.host) return false;
    const path = prefix.pathname.endsWith('/') ? prefix.pathname : `${prefix.pathname}/`;
    return root.pathname === path.slice(0, -1) || root.pathname.startsWith(path);
  } catch {
    return false;
  }
};

const domainCovers = (siteUrl: string, host: string): boolean => {
  const domain = domainOf(siteUrl);
  return !!domain && (host === domain || host.endsWith(`.${domain}`));
};

/** Return the verified Search Console property that covers a project's root URL. */
export const matchGscProperty = (properties: GscSiteProperty[], rootUrl: string | undefined): string | null => {
  const root = rootOf(rootUrl);
  if (!root) return null;
  const usable = properties.filter(verified);
  const domain = domainNames(root.host).map((name) => `${DOMAIN_PREFIX}${name}`);
  const exact = domain.find((candidate) => usable.some((property) => property.siteUrl === candidate && domainOf(property.siteUrl)));
  if (exact) return exact;
  const prefixes = usable.filter((property) => prefixCovers(property.siteUrl, root)).sort((a, b) => b.siteUrl.length - a.siteUrl.length);
  if (prefixes[0]) return prefixes[0].siteUrl;
  const parent = usable
    .filter((property) => domainCovers(property.siteUrl, root.host) && !domain.includes(property.siteUrl))
    .sort((a, b) => b.siteUrl.length - a.siteUrl.length)[0];
  return parent?.siteUrl ?? null;
};

/** Keep a stored property only when it covers the current root; without a root use the first verified property. */
export const selectGscProperty = (properties: GscSiteProperty[], storedProperty: string, rootUrl: string | undefined): string => {
  const root = rootOf(rootUrl);
  const usable = properties.filter(verified);
  if (!root) return rootUrl?.trim() ? '' : usable[0]?.siteUrl || '';
  const stored = usable.find((property) => property.siteUrl === storedProperty);
  if (stored && matchGscProperty([stored], rootUrl) === stored.siteUrl) return stored.siteUrl;
  return matchGscProperty(usable, rootUrl) ?? '';
};
