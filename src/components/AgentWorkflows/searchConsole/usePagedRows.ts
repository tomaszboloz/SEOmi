import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';
export const PAGE_SIZES = [25, 50, 100, 250] as const;

export interface PagedRows<T> {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
  pageSize: number;
  sortKey: string;
  sortDirection: SortDirection;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  toggleSort: (key: string) => void;
}

const compare = (a: string | number, b: string | number): number =>
  typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));

/** Sorts the full row set, then slices one page; sorting always returns to the first page. */
export const usePagedRows = <T,>(
  items: readonly T[],
  sortValues: Record<string, (row: T) => string | number>,
  initialSort: string,
): PagedRows<T> => {
  const [sortKey, setSortKey] = useState(initialSort);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [pageSize, setPageSizeState] = useState<number>(PAGE_SIZES[0]);
  const [page, setPageState] = useState(1);

  const sorted = useMemo(() => {
    const read = sortValues[sortKey] ?? sortValues[initialSort];
    const factor = sortDirection === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => factor * compare(read(a), read(b)));
  }, [items, sortValues, sortKey, sortDirection, initialSort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const rows = sorted.slice(start, start + pageSize);

  return {
    rows,
    total: sorted.length,
    page: current,
    pageCount,
    from: sorted.length === 0 ? 0 : start + 1,
    to: start + rows.length,
    pageSize,
    sortKey,
    sortDirection,
    setPage: (next) => setPageState(Math.min(Math.max(1, next), pageCount)),
    setPageSize: (size) => { setPageSizeState(size); setPageState(1); },
    toggleSort: (key) => {
      setPageState(1);
      if (key === sortKey) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      else { setSortKey(key); setSortDirection(key === 'text' ? 'asc' : 'desc'); }
    },
  };
};
