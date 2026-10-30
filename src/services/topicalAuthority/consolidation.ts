import type { FocusPage } from '@/services/siteFocus';
import { phraseKey } from '@/services/siteFocus/terms';
import type { GscMetricRow } from '@/types';
import type { CannibalGroup } from './types';

/** Observed Search Console rows for the group's URLs. Kept apart from content similarity: neither proves the other. */
export interface GroupGscEvidence {
  status: 'unavailable' | 'no-overlap' | 'available';
  truncated: boolean;
  /** Queries where at least two URLs of the group really received impressions. */
  queries: Array<{ query: string; pages: Array<{ url: string; clicks: number; impressions: number }> }>;
  /** URL with the most clicks (then impressions) across those queries. */
  leader: string | null;
  /** GSC leader differs from the content-based canonical candidate: needs a human decision (#59 D02). */
  conflict: boolean;
}

export interface GscQueryPages { query_pages?: GscMetricRow[]; query_pages_may_be_truncated?: boolean }

const MAX_QUERIES = 5;
const MAX_UNIQUE = 6;

/** Comparable URL identity: case-insensitive host, no fragment, no trailing slash. */
export const urlIdentity = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host.toLowerCase().replace(/^www\./, '')}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`;
  } catch { return url.trim().replace(/\/+$/, ''); }
};

export const gscEvidenceFor = (group: CannibalGroup, data: GscQueryPages | null | undefined): GroupGscEvidence => {
  const truncated = data?.query_pages_may_be_truncated === true;
  if (!data || !Array.isArray(data.query_pages)) return { status: 'unavailable', truncated, queries: [], leader: null, conflict: false };
  const members = new Map(group.urls.map((url) => [urlIdentity(url), url]));
  const byQuery = new Map<string, Map<string, { clicks: number; impressions: number }>>();
  data.query_pages.forEach((row) => {
    const url = members.get(urlIdentity(row.page));
    if (!url || !(row.impressions > 0)) return;
    const pages = byQuery.get(row.query) ?? new Map();
    const current = pages.get(url) ?? { clicks: 0, impressions: 0 };
    pages.set(url, { clicks: current.clicks + row.clicks, impressions: current.impressions + row.impressions });
    byQuery.set(row.query, pages);
  });
  const queries = [...byQuery].filter(([, pages]) => pages.size > 1).map(([query, pages]) => ({
    query, pages: [...pages].map(([url, value]) => ({ url, ...value })).sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions || (a.url < b.url ? -1 : 1)),
  })).sort((a, b) => b.pages.reduce((sum, page) => sum + page.impressions, 0) - a.pages.reduce((sum, page) => sum + page.impressions, 0) || (a.query < b.query ? -1 : 1));
  if (!queries.length) return { status: 'no-overlap', truncated, queries: [], leader: null, conflict: false };
  const totals = new Map<string, { clicks: number; impressions: number }>();
  queries.forEach((row) => row.pages.forEach((page) => {
    const sum = totals.get(page.url) ?? { clicks: 0, impressions: 0 };
    totals.set(page.url, { clicks: sum.clicks + page.clicks, impressions: sum.impressions + page.impressions });
  }));
  const leader = [...totals].sort((a, b) => b[1].clicks - a[1].clicks || b[1].impressions - a[1].impressions || (a[0] < b[0] ? -1 : 1))[0][0];
  return { status: 'available', truncated, queries: queries.slice(0, MAX_QUERIES), leader, conflict: leader !== group.canonical };
};

/**
 * Content each URL holds that no other URL of the group has (its own focus terms), so a merge brief can keep it.
 * Terms come from the crawl only; a URL without such terms gets an empty list, never invented facts.
 */
export const uniqueTermsByUrl = (group: CannibalGroup, pages: FocusPage[], language = ''): Record<string, string[]> => {
  const byUrl = new Map(pages.map((page) => [urlIdentity(page.url), page]));
  const termsOf = (url: string) => (byUrl.get(urlIdentity(url))?.focus_terms ?? [])
    .map((term) => ({ key: phraseKey(term.surface || term.term, language), surface: (term.surface || term.term).toLowerCase(), weight: term.weight }))
    .filter((term): term is { key: string; surface: string; weight: number } => Boolean(term.key));
  const all = new Map(group.urls.map((url) => [url, termsOf(url)]));
  return Object.fromEntries(group.urls.map((url) => {
    const others = new Set(group.urls.filter((other) => other !== url).flatMap((other) => all.get(other)!.map((term) => term.key)));
    const own = all.get(url)!.filter((term) => !others.has(term.key)).sort((a, b) => b.weight - a.weight || (a.surface < b.surface ? -1 : 1));
    return [url, [...new Set(own.map((term) => term.surface))].slice(0, MAX_UNIQUE)];
  }));
};
