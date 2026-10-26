import { parse } from 'tldts';

const DOMAIN_PREFIX = 'sc-domain:';

export const normalizeSiteDomain = (siteUrl: string | null | undefined): string => {
  if (!siteUrl?.trim()) return '';
  const trimmed = siteUrl.trim().toLowerCase();
  const raw = trimmed.startsWith(DOMAIN_PREFIX) ? trimmed.slice(DOMAIN_PREFIX.length) : trimmed;
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsedUrl = new URL(candidate);
    const host = parsedUrl.hostname.replace(/\.$/, '');
    const info = parse(host, { allowPrivateDomains: true });
    return (info.domain || host).replace(/^www\./, '');
  } catch {
    const info = parse(raw, { allowPrivateDomains: true });
    return (info.domain || info.hostname || '').replace(/^www\./, '');
  }
};

export const areSitesIndependent = (siteA: string | null | undefined, siteB: string | null | undefined): boolean => {
  const domainA = normalizeSiteDomain(siteA);
  const domainB = normalizeSiteDomain(siteB);
  return Boolean(domainA && domainB && domainA !== domainB);
};

const parseHttpUrl = (value: string): URL | null => {
  try {
    const url = new URL(value);
    const proto = url.protocol.toLowerCase();
    if (proto !== 'http:' && proto !== 'https:') return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
};

const cleanHost = (url: URL): string => url.hostname.toLowerCase().replace(/\.$/, '');

export const propertyMatchScore = (propertySite: string, target: string): number => {
  const pTrim = propertySite.trim();
  const tTrim = target.trim();
  if (!pTrim || !tTrim) return 0;

  const pIsDomain = pTrim.toLowerCase().startsWith(DOMAIN_PREFIX);
  const tIsDomain = tTrim.toLowerCase().startsWith(DOMAIN_PREFIX);

  if (pIsDomain && tIsDomain) {
    const pDom = pTrim.slice(DOMAIN_PREFIX.length).toLowerCase().replace(/\.$/, '');
    const tDom = tTrim.slice(DOMAIN_PREFIX.length).toLowerCase().replace(/\.$/, '');
    return pDom === tDom ? 1000 : 0;
  }
  if (tIsDomain) {
    return 0;
  }
  if (pIsDomain) {
    const pDom = pTrim.slice(DOMAIN_PREFIX.length).toLowerCase().replace(/\.$/, '');
    const tUrl = parseHttpUrl(tTrim);
    if (!tUrl) return 0;
    const tHost = cleanHost(tUrl);
    return (tHost === pDom || tHost.endsWith(`.${pDom}`)) ? 500 + pDom.length : 0;
  }

  const pUrl = parseHttpUrl(pTrim);
  const tUrl = parseHttpUrl(tTrim);
  if (!pUrl || !tUrl) return 0;
  if (pUrl.protocol.toLowerCase() !== tUrl.protocol.toLowerCase() || pUrl.port !== tUrl.port) return 0;
  if (cleanHost(pUrl) !== cleanHost(tUrl)) return 0;

  const pPath = pUrl.pathname.endsWith('/') ? pUrl.pathname : `${pUrl.pathname}/`;
  const tPath = tUrl.pathname.endsWith('/') ? tUrl.pathname : `${tUrl.pathname}/`;
  if (pPath === tPath && pUrl.search === tUrl.search) return 1000;
  if (!pUrl.search && tPath.startsWith(pPath)) return 600 + pPath.length;
  return 0;
};
