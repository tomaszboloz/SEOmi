import type { Vector } from '@/services/embeddings/types';
import { cosine } from '@/services/embeddings/vector';

/**
 * Internal link donors for a draft (#94 GEM-94-07). Decision (default chosen by agent): the code window
 * similarity .60–<.85 (pages at or above .85 are overlap/conflict candidates, not donors) and donor TRS >= 70,
 * at most 3, ranked by similarity x TRS. The placement is a proposal for a body passage on the same topic;
 * the first paragraphs are not presented as "above the fold" because no viewport was rendered.
 */
export const DONOR_PROFILE = { minSimilarity: 0.6, maxSimilarity: 0.85, minTrs: 70, max: 3 } as const;

export interface DonorCandidate { url: string; vector: Vector; trs: number; links?: readonly string[] }
export interface DonorSuggestion {
  url: string;
  similarity: number;
  trs: number;
  /** null when the crawl recorded no links for the donor (older runs). */
  alreadyLinks: boolean | null;
  /** Proposed anchor taken from the draft title; null when the draft has no title line. */
  anchor: string | null;
  placement: 'body-related-passage';
}

const normalized = (url: string): string => {
  try { const parsed = new URL(url); parsed.hash = ''; return parsed.href.replace(/\/$/u, ''); } catch { return url; }
};

/** First non-empty line, without Markdown heading marks, capped at 8 words. */
export const draftAnchor = (text: string): string | null => {
  const line = text.split('\n').map((value) => value.replace(/^#+\s*/u, '').trim()).find(Boolean);
  if (!line) return null;
  const words = line.split(/\s+/u);
  return words.length > 8 ? null : line;
};

export const donorSuggestions = (draft: { url: string; vector: Vector; text?: string }, pages: readonly DonorCandidate[]): DonorSuggestion[] => {
  const target = draft.url ? normalized(draft.url) : null;
  const anchor = draftAnchor(draft.text ?? '');
  return pages
    .filter((page) => !target || normalized(page.url) !== target)
    .map((page) => ({ page, similarity: Math.round(cosine(draft.vector, page.vector) * 1000) / 1000 }))
    .filter(({ page, similarity }) => similarity >= DONOR_PROFILE.minSimilarity && similarity < DONOR_PROFILE.maxSimilarity && page.trs >= DONOR_PROFILE.minTrs)
    .sort((left, right) => right.similarity * right.page.trs - left.similarity * left.page.trs || left.page.url.localeCompare(right.page.url))
    .slice(0, DONOR_PROFILE.max)
    .map(({ page, similarity }) => ({
      url: page.url, similarity, trs: page.trs,
      alreadyLinks: !page.links ? null : !!target && page.links.some((link) => normalized(link) === target),
      anchor, placement: 'body-related-passage' as const,
    }));
};
