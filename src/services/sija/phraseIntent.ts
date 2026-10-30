import { renderCrawlPage } from '@/services/tauri/rendered';
import { classify, funnelCounts, funnelStage } from './classify';
import { formatGaps, type FormatGap } from './formatGaps';
import { parseFeatures } from './features';
import { ssas, type SsasResult } from './ssas';
import type { Funnel, MicroIntent, ObservedMicroIntent, PageFeatures } from './types';

export const PHRASE_INTENT_TOP = 5;

export type FetchHtml = (url: string) => Promise<string>;

export interface PhraseIntentReport {
  page: ObservedMicroIntent;
  ssas: SsasResult;
  /** Funnel stage counts of the TOP pages that were really rendered; no traffic shares. */
  funnel: Record<Funnel, number>;
  requested: number;
  analysed: number;
  /** Formats most rendered TOP pages use and this page lacks (GEM-69-08). */
  gaps: FormatGap[];
  /** Intent held by a strict majority of the rendered TOP pages; null without a majority. */
  serpIntent: { intent: MicroIntent | null; pages: number };
  /** Observed page intent vs SERP intent; unknown when either side is unclear. */
  intentMatch: 'match' | 'mismatch' | 'unknown';
  /** Funnel drill-down: every rendered TOP page with its observed intent and stage. */
  topPages: Array<{ url: string; intent: MicroIntent | null; stage: Funnel | null }>;
}

/** GEM-69-08: intent-vs-SERP from the real rendered TOP pages only. */
export const serpIntentOf = (top: readonly ObservedMicroIntent[]): { intent: MicroIntent | null; pages: number } => {
  const counts = new Map<MicroIntent, number>();
  top.forEach((item) => { if (item.primary) counts.set(item.primary, (counts.get(item.primary) ?? 0) + 1); });
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return best && best[1] > top.length / 2 ? { intent: best[0], pages: best[1] } : { intent: null, pages: 0 };
};

export const intentMatchOf = (page: ObservedMicroIntent, serp: MicroIntent | null): PhraseIntentReport['intentMatch'] => {
  if (!page.primary || !serp) return 'unknown';
  return page.primary === serp || page.mixed.includes(serp) ? 'match' : 'mismatch';
};

const renderHtml: FetchHtml = async (url) => {
  const snapshot = await renderCrawlPage({ url });
  if (snapshot.httpStatus && (snapshot.httpStatus < 200 || snapshot.httpStatus >= 400)) throw new Error(`http-${snapshot.httpStatus}`);
  return snapshot.html;
};

/** SIJA for one phrase: the page and up to 5 TOP URLs are rendered one by one; failed pages are counted, not guessed. */
export const analyzePhraseIntent = async (targetUrl: string, topUrls: readonly string[], fetchHtml: FetchHtml = renderHtml): Promise<PhraseIntentReport> => {
  const page = parseFeatures(await fetchHtml(targetUrl));
  const requested = topUrls.slice(0, PHRASE_INTENT_TOP);
  const top: PageFeatures[] = [];
  const urls: string[] = [];
  for (const url of requested) {
    try { top.push(parseFeatures(await fetchHtml(url))); urls.push(url); } catch { /* counted through `analysed` */ }
  }
  const observed = classify(page);
  const topIntents = top.map(classify);
  const serpIntent = serpIntentOf(topIntents);
  return {
    page: observed, ssas: ssas(page, top), funnel: funnelCounts(topIntents), requested: requested.length, analysed: top.length, gaps: formatGaps(page, top),
    serpIntent, intentMatch: intentMatchOf(observed, serpIntent.intent),
    topPages: topIntents.map((item, index) => ({ url: urls[index], intent: item.primary, stage: funnelStage(item) })),
  };
};
