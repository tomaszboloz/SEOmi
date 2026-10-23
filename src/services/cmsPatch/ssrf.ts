import { isPrivateHost } from '@/services/projectValidation';
import { CmsError } from './types';

/** HTTPS only, no embedded credentials, no private/loopback/link-local host. Throws CmsError('unsafe-url'). */
export const assertSafeCmsUrl = (input: string): URL => {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new CmsError('unsafe-url', 'Invalid CMS URL');
  }
  if (url.protocol !== 'https:') throw new CmsError('unsafe-url', 'CMS URL must use https');
  if (url.username || url.password) throw new CmsError('unsafe-url', 'CMS URL must not embed credentials');
  if (!url.hostname || isPrivateHost(url.hostname)) throw new CmsError('unsafe-url', 'CMS host is private or local');
  return url;
};

/** Builds `base + path` after validating the base; the path can never change host. */
export const cmsUrl = (baseUrl: string, path: string, query: Record<string, string> = {}): string => {
  const base = assertSafeCmsUrl(baseUrl);
  const url = new URL(`${base.origin}${base.pathname.replace(/\/+$/, '')}${path}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return assertSafeCmsUrl(url.toString()).toString();
};
