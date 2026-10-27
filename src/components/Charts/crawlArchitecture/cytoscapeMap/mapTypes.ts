export type LayoutMode = 'hierarchy' | 'force';
export type StatusClass = '2xx' | '3xx' | '4xx' | '5xx' | 'other';

export const STATUS_CLASSES: readonly StatusClass[] = ['2xx', '3xx', '4xx', '5xx', 'other'];

export interface MapNode {
  id: string;
  url: string;
  title: string;
  status: number;
  statusClass: StatusClass;
  depth: number;
  inlinks: number;
  /** Topical Relevance Score from the Site Focus report, when available. */
  trs: number | null;
  section: string;
  orphan: boolean;
  problem: boolean;
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  links: number;
}

export interface MapFilters {
  statuses: StatusClass[];
  maxDepth: number | null;
  problemsOnly: boolean;
}

export const emptyFilters = (): MapFilters => ({ statuses: [...STATUS_CLASSES], maxDepth: null, problemsOnly: false });
