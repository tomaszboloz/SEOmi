import type { CoverageStatus, SubtopicCoverage } from '@/services/topicalAuthority';

export type CoverageFilter = 'all' | 'gaps' | 'shallow' | 'cannibalized';
export type CoverageSort = 'importance' | 'similarity' | 'label';
export const FILTERS: CoverageFilter[] = ['all', 'gaps', 'shallow', 'cannibalized'];
export const SORTS: CoverageSort[] = ['importance', 'similarity', 'label'];

/** Coverage map view state; kept by the parent so drill-down and back do not lose the selection (#60 GEM-60-05). */
export interface CoverageView { filter: CoverageFilter; pillar: string; url: string; sort: CoverageSort }
export const DEFAULT_VIEW: CoverageView = { filter: 'all', pillar: '', url: '', sort: 'importance' };

export const matchesStatus = (filter: CoverageFilter, status: CoverageStatus): boolean =>
  filter === 'all' || (filter === 'gaps' && status === 'missing_gap') || (filter === 'shallow' && status === 'covered_shallow') || (filter === 'cannibalized' && status === 'cannibalized');

const fold = (text: string): string => text.normalize('NFKC').toLocaleLowerCase();

/** URL filter: substring of any URL assigned to the sub-topic (case-insensitive); empty matches everything. */
const matchesUrl = (needle: string, row: SubtopicCoverage): boolean => !needle.trim() || row.urls.some((url) => fold(url).includes(fold(needle.trim())));

const byId = (a: SubtopicCoverage, b: SubtopicCoverage): number => (a.subtopicId < b.subtopicId ? -1 : a.subtopicId > b.subtopicId ? 1 : 0);
const COMPARE: Record<CoverageSort, (a: SubtopicCoverage, b: SubtopicCoverage) => number> = {
  importance: (a, b) => b.importance - a.importance || byId(a, b),
  similarity: (a, b) => b.similarity - a.similarity || byId(a, b),
  label: (a, b) => a.label.localeCompare(b.label) || byId(a, b),
};

/** Rows of one pillar after every filter, in a stable order (ties broken by the stable sub-topic ID). */
export const viewRows = (rows: SubtopicCoverage[], pillar: string, view: CoverageView): SubtopicCoverage[] =>
  rows.filter((row) => row.pillar === pillar && (!view.pillar || view.pillar === pillar) && matchesStatus(view.filter, row.status) && matchesUrl(view.url, row))
    .sort(COMPARE[view.sort]);

/** Status counts respect the pillar and URL filters so the numbers match what a click will show. */
export const statusCounts = (rows: SubtopicCoverage[], view: CoverageView): Record<CoverageFilter, number> =>
  Object.fromEntries(FILTERS.map((filter) => [filter, rows.filter((row) => (!view.pillar || row.pillar === view.pillar) && matchesUrl(view.url, row) && matchesStatus(filter, row.status)).length])) as Record<CoverageFilter, number>;
