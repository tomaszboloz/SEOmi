import { renderCrawlPage } from '@/services/tauri/rendered';
import { classify, funnelCounts } from './classify';
import { parseFeatures } from './features';
import { ssas, type SsasResult } from './ssas';
import type { Funnel, ObservedMicroIntent, PageFeatures } from './types';

export const PHRASE_INTENT_TOP = 5;

export type FetchHtml = (url: string) => Promise<string>;

export interface PhraseIntentReport {
  page: ObservedMicroIntent;
  ssas: SsasResult;
  /** Funnel stage counts of the TOP pages that were really rendered; no traffic shares. */
  funnel: Record<Funnel, number>;
  requested: number;
  analysed: number;
}

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
  for (const url of requested) {
    try { top.push(parseFeatures(await fetchHtml(url))); } catch { /* counted through `analysed` */ }
  }
  return { page: classify(page), ssas: ssas(page, top), funnel: funnelCounts(top.map(classify)), requested: requested.length, analysed: top.length };
};
