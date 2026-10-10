import type { TopTenSerpRow } from './types';

const rankOf = (row: TopTenSerpRow): number => {
  const rank = row.rank_absolute ?? row.rank;
  return typeof rank === 'number' && Number.isInteger(rank) ? rank : 0;
};

export const normalizeSerpUrl = (value: string): string | null => {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/u, '');
    return url.toString();
  } catch {
    return null;
  }
};

/** Keeps only provider-labelled organic results in positions 1–10. */
export const selectOrganicTopTen = (rows: readonly TopTenSerpRow[]): TopTenSerpRow[] => {
  const seen = new Set<string>();
  return rows
    .map((row, index) => ({ row, index, rank: rankOf(row), url: normalizeSerpUrl(row.url ?? '') }))
    .filter((item) => item.row.type?.toLocaleLowerCase() === 'organic' && item.rank >= 1 && item.rank <= 10 && item.url)
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .map((item) => ({ ...item.row, url: item.url!, rank: item.rank }));
};
