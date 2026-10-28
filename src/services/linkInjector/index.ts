import type { CrawledPageSummary } from '@/types';
import type { InternalLinkOpportunity } from '@/services/internalLinkOpportunities';
import { busUrlKey } from '@/services/recommendationBus/url';
import { expectedSprGain, type SprsGainContext } from './gain';
import { bestSection, type InjectionSection } from './section';
import { buildSnippet, type InjectionSnippet } from './snippet';

export * from './gain';
export * from './section';
export * from './snippet';

export const MAX_INJECTIONS = 10;
/** Strongest lexical candidates checked for a section and solved for gain; bounds solver runs. */
export const INJECTION_POOL = 40;

export interface LinkInjection extends InjectionSnippet {
  id: string;
  sourceUrl: string;
  sourceTitle: string;
  targetUrl: string;
  targetTitle: string;
  sharedTerms: string[];
  weightedJaccard: number;
  section: InjectionSection;
  /** SPRS change of the target (0-100 scale); null when the solver cannot place both pages. */
  expectedSprGain: number | null;
}

/**
 * Contextual link injections (#128) from already quarantine-filtered opportunities: donor section, ready
 * sentence with the link and solver-estimated SPRS change. Candidates without a matching H2/H3 are skipped.
 */
export const buildLinkInjections = (
  opportunities: readonly InternalLinkOpportunity[], pages: readonly CrawledPageSummary[], gain: SprsGainContext | null,
): LinkInjection[] => {
  const byUrl = new Map<string, CrawledPageSummary>();
  pages.forEach((page) => [page.url, page.final_url].forEach((url) => {
    const key = url ? busUrlKey(url) : '';
    if (key && !byUrl.has(key)) byUrl.set(key, page);
  }));
  const rows = opportunities.slice(0, INJECTION_POOL).flatMap((item): LinkInjection[] => {
    const donor = byUrl.get(busUrlKey(item.sourceUrl));
    const section = donor ? bestSection(donor, item.sharedTerms) : null;
    if (!donor || !section) return [];
    return [{
      ...buildSnippet(donor, item.targetUrl, item.targetTitle),
      id: item.id, sourceUrl: item.sourceUrl, sourceTitle: item.sourceTitle, targetUrl: item.targetUrl, targetTitle: item.targetTitle,
      sharedTerms: item.sharedTerms, weightedJaccard: item.weightedJaccard, section,
      expectedSprGain: gain ? expectedSprGain(gain, item.sourceUrl, item.targetUrl, item.weightedJaccard) : null,
    }];
  });
  const rank = (value: number | null): number => value ?? Number.NEGATIVE_INFINITY;
  rows.sort((a, b) => rank(b.expectedSprGain) - rank(a.expectedSprGain) || b.weightedJaccard - a.weightedJaccard || a.id.localeCompare(b.id));
  return rows.slice(0, MAX_INJECTIONS);
};
