import { buildSiteFocusReport } from '@/services/siteFocus';
import type { FocusPage } from '@/services/siteFocus';
import type { ScoringModel } from '@/services/siteFocus/pageScore';
import type { PageTerms } from '@/services/siteFocus/terms';
import { diabetesSite } from './siteFocusFixtures';

export const START = 'https://diabetes.test/';
export const NOW = '2026-10-15T00:00:00Z';
export const build = (pages: FocusPage[] = diabetesSite(), options = {}) => buildSiteFocusReport(pages, START, { now: NOW, ...options });
export const termsOf = (list: string[], count = 3) => list.map((term) => [term, count] as [string, number]);

export const entry = (key: string, surface: string, count: number) => [key, { key, surface, count, tf: count }] as const;
export const crafted = (): { page: PageTerms; model: ScoringModel } => ({
  page: { url: 'u', language: 'en', degraded: false, entries: new Map([entry('a', 'alpha', 2)]), neighbors: new Map() },
  model: { termCluster: new Map([['a', 'core'], ['f1', 'x'], ['f2', 'y']]), coreClusterId: 'core', coreWeights: new Map([['a', 4]]), kCore: ['a'] },
});
