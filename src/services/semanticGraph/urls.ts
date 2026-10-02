import type { CrawledPageSummary } from '@/types';

export const normalizeGraphUrl = (value: string | null | undefined, base?: string): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed, base);
    url.hash = '';
    url.hostname = url.hostname.toLocaleLowerCase();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return trimmed.replace(/#.*$/, '').replace(/\/+$/, '');
  }
};

/** Exact request identities take precedence; ambiguous redirect aliases have no owner. */
export const pageOwnersByUrl = (pages: CrawledPageSummary[]): Map<string, string> => {
  const requested = new Map<string, Set<string>>();
  const aliases = new Map<string, Set<string>>();
  const record = (map: Map<string, Set<string>>, url: string, id: string): void => {
    if (!url) return;
    const owners = map.get(url) ?? new Set<string>();
    owners.add(id);
    map.set(url, owners);
  };
  pages.forEach((page, index) => {
    record(requested, normalizeGraphUrl(page.url), `page-${index}`);
    record(aliases, normalizeGraphUrl(page.final_url), `page-${index}`);
  });
  const result = new Map<string, string>();
  for (const key of new Set([...requested.keys(), ...aliases.keys()])) {
    const owners = requested.get(key) ?? aliases.get(key)!;
    if (owners.size === 1) result.set(key, owners.values().next().value!);
  }
  return result;
};
