import type { CrawledPageSummary } from '@/types';
import { crawlFunnelStage } from './crawlFeatures';
import type { Funnel } from './types';

export type FunnelPageInput = Pick<CrawledPageSummary, 'url' | 'final_url' | 'dom_structure' | 'word_count' | 'title' | 'heading_counts' | 'semantic_links'>;
export type FunnelTransitions = Record<Funnel, Record<Funnel, number>>;
export interface FunnelTransitionReport { transitions: FunnelTransitions; classifiedPages: number; unclassifiedPages: number; /** Links whose source or target has no stage; counted, never guessed. */ skippedLinks: number }

const STAGES: Funnel[] = ['TOFU', 'MOFU', 'BOFU'];
const key = (url: string): string => url.replace(/#.*$/u, '').replace(/\/$/u, '');

/** GEM-69-06: counts internal main-content links between funnel stages of crawled pages (real links only). */
export const funnelTransitions = (pages: FunnelPageInput[]): FunnelTransitionReport => {
  const stages = new Map<string, Funnel>();
  pages.forEach((page) => { const stage = crawlFunnelStage(page); if (stage) { stages.set(key(page.url), stage); stages.set(key(page.final_url), stage); } });
  const transitions = Object.fromEntries(STAGES.map((from) => [from, Object.fromEntries(STAGES.map((to) => [to, 0]))])) as FunnelTransitions;
  let skippedLinks = 0;
  pages.forEach((page) => {
    const from = stages.get(key(page.url));
    (page.semantic_links ?? []).filter((link) => link.is_internal).forEach((link) => {
      const to = stages.get(key(link.target_url));
      if (from && to) transitions[from][to] += 1; else skippedLinks += 1;
    });
  });
  const classifiedPages = pages.filter((page) => stages.has(key(page.url))).length;
  return { transitions, classifiedPages, unclassifiedPages: pages.length - classifiedPages, skippedLinks };
};
