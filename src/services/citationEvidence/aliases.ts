import type { CrawledPageSummary } from '@/types';
import type { CrawlCitationMatchKind } from './types';
import { normalizeHttpUrl } from './urls';

interface CitationAlias {
  page: CrawledPageSummary;
  matchKind: CrawlCitationMatchKind;
}

const priorities: Record<CrawlCitationMatchKind, number> = {
  request_url: 0, final_url: 1, redirect_from: 2, redirect_to: 3,
};

/** Prefer exact requests; equal-priority aliases from different pages are ambiguous. */
export const citationAliases = (pages: CrawledPageSummary[]): Map<string, CitationAlias> => {
  const candidates = new Map<string, { priority: number; owners: Map<number, CitationAlias> }>();
  const add = (raw: string | undefined, page: CrawledPageSummary, index: number, matchKind: CrawlCitationMatchKind): void => {
    const normalized = raw ? normalizeHttpUrl(raw) : null;
    if (!normalized) return;
    const priority = priorities[matchKind];
    const previous = candidates.get(normalized);
    if (!previous || priority < previous.priority) {
      candidates.set(normalized, { priority, owners: new Map([[index, { page, matchKind }]]) });
    } else if (priority === previous.priority) {
      previous.owners.set(index, { page, matchKind });
    }
  };
  pages.forEach((page, index) => {
    add(page.url, page, index, 'request_url');
    add(page.final_url, page, index, 'final_url');
    (page.redirect_chain ?? []).forEach((redirect) => {
      add(redirect.from_url, page, index, 'redirect_from');
      add(redirect.to_url, page, index, 'redirect_to');
    });
  });
  return new Map([...candidates].flatMap(([url, entry]) => entry.owners.size === 1
    ? [[url, entry.owners.values().next().value!] as const] : []));
};
