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
