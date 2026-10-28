import type { PageFocus, SfsBand } from '@/services/siteFocus';
import { isBorderlineTrs, OFF_TOPIC_BELOW, ON_TOPIC_FROM, STRONG_FROM } from '@/services/siteFocus/trsPolicy';

export type FocusFilter = 'all' | 'critical' | 'borderline' | 'strong';
export const FOCUS_FILTERS: FocusFilter[] = ['all', 'critical', 'borderline', 'strong'];

export const CRITICAL_BELOW = OFF_TOPIC_BELOW;
export { ON_TOPIC_FROM, STRONG_FROM };

export type Tone = 'green' | 'yellow' | 'red';

/** TRS colour band: green from 75, yellow 60-74, red below 60. */
export const trsTone = (trs: number): Tone => (trs >= STRONG_FROM ? 'green' : trs >= ON_TOPIC_FROM ? 'yellow' : 'red');

export const TONE_BAR: Record<Tone, string> = { green: 'bg-emerald-500', yellow: 'bg-amber-400', red: 'bg-rose-500' };
export const TONE_TEXT: Record<Tone, string> = { green: 'text-emerald-300', yellow: 'text-amber-300', red: 'text-rose-300' };

export const BAND_BAR: Record<SfsBand, string> = {
  excellent: 'bg-emerald-500',
  good: 'bg-lime-400',
  moderate: 'bg-amber-400',
  weak: 'bg-orange-500',
  critical: 'bg-rose-500',
};
export const BAND_TEXT: Record<SfsBand, string> = {
  excellent: 'text-emerald-300',
  good: 'text-lime-300',
  moderate: 'text-amber-300',
  weak: 'text-orange-300',
  critical: 'text-rose-300',
};

export const matchesFilter = (page: PageFocus, filter: FocusFilter): boolean => {
  if (filter === 'critical') return page.trs < CRITICAL_BELOW;
  if (filter === 'borderline') return isBorderlineTrs(page.trs);
  if (filter === 'strong') return page.trs >= STRONG_FROM;
  return true;
};

export const visiblePages = (pages: PageFocus[], ignoreTechnical: boolean): PageFocus[] =>
  pages.filter((page) => !page.skipped && !(ignoreTechnical && page.type === 'technical'));

export const filterCounts = (pages: PageFocus[]): Record<FocusFilter, number> => ({
  all: pages.length,
  critical: pages.filter((page) => matchesFilter(page, 'critical')).length,
  borderline: pages.filter((page) => matchesFilter(page, 'borderline')).length,
  strong: pages.filter((page) => matchesFilter(page, 'strong')).length,
});

export type TreeRow =
  | { kind: 'dir'; key: string; depth: number; label: string }
  | { kind: 'page'; key: string; depth: number; label: string; page: PageFocus };

const segmentsOf = (url: string): string[] => {
  try {
    return new URL(url).pathname.split('/').filter(Boolean);
  } catch {
    return [url];
  }
};

/** Flat, depth-annotated URL tree: homepage, then sections, then pages. */
export const buildTreeRows = (pages: PageFocus[]): TreeRow[] => {
  const entries = pages
    .map((page) => ({ page, segments: segmentsOf(page.url) }))
    .sort((a, b) => a.segments.join('/').localeCompare(b.segments.join('/')) || Number(a.page.url > b.page.url) - Number(a.page.url < b.page.url));
  const emitted = new Set<string>();
  const rows: TreeRow[] = [];
  entries.forEach(({ page, segments }) => {
    segments.slice(0, -1).forEach((segment, index) => {
      const key = `/${segments.slice(0, index + 1).join('/')}`;
      if (emitted.has(key)) return;
      emitted.add(key);
      rows.push({ kind: 'dir', key, depth: index + 1, label: segment });
    });
    if (segments.length) emitted.add(`/${segments.join('/')}`);
    rows.push({ kind: 'page', key: page.url, depth: segments.length, label: segments.length ? segments[segments.length - 1] : '/', page });
  });
  return rows;
};
