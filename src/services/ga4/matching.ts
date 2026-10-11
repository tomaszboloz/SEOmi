import type { Ga4Property } from '@/types/ga4';

interface UrlScope { protocol: string; host: string; port: string; path: string; }

const scopeOf = (value: string): UrlScope | null => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) return null;
    const path = url.pathname || '/';
    return { protocol: url.protocol, host: url.hostname.toLowerCase().replace(/\.$/, ''), port: url.port, path: path === '/' ? '/' : path.replace(/\/+$/, '') || '/' };
  } catch { return null; }
};

const pathCovers = (streamPath: string, rootPath: string): boolean => {
  if (streamPath === '/') return true;
  return rootPath === streamPath || rootPath.startsWith(`${streamPath}/`);
};

export const ga4StreamMatchesRoot = (streamUrl: string, rootUrl: string): boolean => {
  const stream = scopeOf(streamUrl);
  const root = scopeOf(rootUrl);
  return !!stream && !!root && stream.protocol === root.protocol && stream.host === root.host && stream.port === root.port && pathCovers(stream.path, root.path);
};

export const matchingGa4Properties = (properties: Ga4Property[], rootUrl?: string): Ga4Property[] => {
  if (!rootUrl?.trim()) return [];
  const matches = new Map<string, Ga4Property>();
  for (const property of properties) {
    const streams = property.stream_urls.filter((url) => ga4StreamMatchesRoot(url, rootUrl));
    if (!streams.length || matches.has(property.name)) continue;
    matches.set(property.name, { ...property, stream_urls: streams });
  }
  return [...matches.values()];
};

/** Return a property only when the project root identifies exactly one GA4 property. */
export const matchGa4Property = (properties: Ga4Property[], rootUrl?: string): Ga4Property | null => {
  const matches = matchingGa4Properties(properties, rootUrl);
  return matches.length === 1 ? matches[0] : null;
};
