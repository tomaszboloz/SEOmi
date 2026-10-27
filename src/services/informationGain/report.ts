import { semanticPageLanguage } from '@/services/semanticText';
import { buildBaseline } from './baseline';
import { bandOf, evaluatePage, type EvaluateOptions } from './page';
import {
  MAX_EVALUATED_PAGES, type BaselineDoc, type BaselineMeta, type Coded, type InfoGainPage, type PageIgos, type SectionZone, type SiteIgos,
} from './types';

export interface IgosInput {
  pages: InfoGainPage[];
  /** Competitor pages from the SERP of the Core Topic. */
  baselineDocs: BaselineDoc[];
  queries?: string[];
  source?: string;
  language?: string;
  now?: string;
  thresholds?: EvaluateOptions['thresholds'];
}

const mean = (values: number[]): number => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0);

const dominantLanguage = (pages: InfoGainPage[]): string => {
  const counts = new Map<string, number>();
  pages.forEach((page) => {
    const language = (semanticPageLanguage(page) ?? '').split(/[-_]/)[0].toLowerCase();
    if (language) counts.set(language, (counts.get(language) ?? 0) + 1);
  });
  return [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? '';
};

const siteRecommendations = (pages: PageIgos[], meta: BaselineMeta): Coded[] => {
  const out: Coded[] = [];
  if (meta.thin) out.push({ code: 'collect-baseline', params: { docs: meta.docs } });
  const count = (code: string): number => pages.filter((page) => page.recommendations.some((item) => item.code === code)).length;
  ['rewrite-echo-sections', 'add-first-hand', 'add-data', 'add-novel-entities', 'fill-consensus', 'remove-drift-sections']
    .map((code): Coded => ({ code, params: { pages: count(code) } }))
    .filter((item) => Number(item.params.pages) > 0)
    .sort((a, b) => Number(b.params.pages) - Number(a.params.pages))
    .forEach((item) => out.push(item));
  return out;
};

/**
 * Site Information Gain & Originality from real data only: needs competitor pages. Returns null (empty state)
 * when the baseline has fewer than two readable documents; never invents a consensus.
 */
export const buildIgosReport = (input: IgosInput): SiteIgos | null => {
  const language = input.language ?? dominantLanguage(input.pages);
  const baseline = buildBaseline(input.baselineDocs, language);
  if (!baseline) return null;
  const candidates = input.pages
    .filter((page) => page.content_sections?.length)
    .sort((a, b) => (b.word_count ?? 0) - (a.word_count ?? 0) || (a.url < b.url ? -1 : 1));
  const chosen = candidates.slice(0, MAX_EVALUATED_PAGES);
  const pages = chosen.map((page) => evaluatePage(page, baseline, { thresholds: input.thresholds }));
  const zone = (key: SectionZone): number => mean(pages.map((page) => page.zones[key]));
  const fhem = pages.map((page) => page.parts.fhem).filter((value): value is number => value !== null);
  const score = mean(pages.map((page) => page.score));
  const meta: BaselineMeta = {
    docs: baseline.docs, urls: baseline.urls, consensusEntities: baseline.consensus.size, thin: baseline.thin,
    queries: input.queries ?? [], source: input.source ?? '',
  };
  return {
    score, band: bandOf(score),
    parts: { nefr: mean(pages.map((page) => page.parts.nefr)), edsi: mean(pages.map((page) => page.parts.edsi)), sdd: mean(pages.map((page) => page.parts.sdd)), fhem: fhem.length ? mean(fhem) : null },
    zones: { echo: zone('echo'), gain: zone('gain'), drift: zone('drift') },
    pages: [...pages].sort((a, b) => a.score - b.score || (a.url < b.url ? -1 : 1)),
    evaluated: pages.length, skipped: input.pages.length - candidates.length, truncated: candidates.length - chosen.length,
    fhemUnavailablePages: pages.length - fhem.length, baseline: meta, recommendations: siteRecommendations(pages, meta), generatedAt: input.now ?? new Date().toISOString(),
  };
};
