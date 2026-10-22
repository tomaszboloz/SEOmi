import type { FocusPage } from '@/services/siteFocus';
import { prepare } from '@/services/siteFocus/evaluate';
import { normalizeUrl } from '@/services/siteFocus/pageType';
import { buildTermStats, tfidfVector } from '@/services/siteFocus/terms';
import { PRE_PUBLISH_COSINE } from './cannibal';
import { cosine } from './context';

export interface DraftOverlap { url: string; similarity: number }

const DRAFT_URL = 'https://draft.invalid/new';

/** Pre-publish cannibalization check: live pages the draft overlaps with at or above 85% (cosine on TF-IDF vectors). */
export const checkDraftOverlap = (draft: { title: string; body: string }, pages: FocusPage[], startUrl: string, language?: string): DraftOverlap[] => {
  const text = `${draft.title}\n${draft.body}`.trim();
  if (!text) return [];
  const stub = { url: DRAFT_URL, final_url: DRAFT_URL, title: draft.title, semantic_excerpts: [draft.body], links: [], http_status: 200, content_type: 'text/html' } as unknown as FocusPage;
  const items = prepare([...pages, stub], startUrl, language).filter((item) => !item.skipped);
  const stats = buildTermStats(items.map((item) => item.terms));
  const vectors = items.map((item) => ({ url: normalizeUrl(item.page.final_url || item.page.url), vector: tfidfVector(item.terms, stats) }));
  const own = vectors.find((row) => row.url === normalizeUrl(DRAFT_URL));
  if (!own) return [];
  return vectors.filter((row) => row !== own).map((row) => ({ url: row.url, similarity: Math.round(cosine(own.vector, row.vector) * 1000) / 10 }))
    .filter((row) => row.similarity >= PRE_PUBLISH_COSINE * 100).sort((a, b) => b.similarity - a.similarity || (a.url < b.url ? -1 : 1));
};
