import type { BacklinkProfileData } from '@/types';
import type { SourceEvidence } from './sources';

/**
 * Link-level anchor context (#93 GEM-93-02): where the provider-reported anchor text appears in the fetched
 * source text. The extracted text has no link markup, so a located anchor is evidence of the surrounding
 * words, not proof that this exact occurrence is the link; several occurrences stay "ambiguous".
 */
export type AnchorContextStatus = 'located' | 'ambiguous' | 'not-found' | 'no-anchor-text' | 'source-unavailable';
export interface AnchorContext {
  sourceUrl: string;
  targetUrl: string;
  anchor: string;
  follow: boolean;
  status: AnchorContextStatus;
  occurrences: number;
  offset: number | null;
  excerpt: string | null;
}

export const ANCHOR_CONTEXT_CHARS = 120;
export const MAX_ANCHOR_CONTEXTS = 100;

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const occurrencesOf = (text: string, anchor: string): number[] => {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escape(anchor).replace(/\s+/gu, '\\s+')}(?![\\p{L}\\p{N}])`, 'giu');
  return [...text.matchAll(pattern)].map((match) => match.index);
};

const excerptAt = (text: string, offset: number, length: number): string => {
  const start = Math.max(0, offset - ANCHOR_CONTEXT_CHARS);
  const end = Math.min(text.length, offset + length + ANCHOR_CONTEXT_CHARS);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/gu, ' ').trim()}${end < text.length ? '…' : ''}`;
};

/** One entry per analysed source page and distinct link (target and anchor) the provider reported for it. */
export const anchorContexts = (profile: BacklinkProfileData, sources: readonly SourceEvidence[]): AnchorContext[] => {
  const bySource = new Map(sources.map((source) => [source.sourceUrl, source]));
  const seen = new Set<string>();
  const out: AnchorContext[] = [];
  for (const link of profile.backlinks) {
    const source = bySource.get(link.source_url);
    const anchor = link.anchor_text.trim().replace(/\s+/gu, ' ');
    const key = `${link.source_url}\n${link.target_url}\n${anchor.toLowerCase()}`;
    if (!source || seen.has(key) || out.length >= MAX_ANCHOR_CONTEXTS) continue;
    seen.add(key);
    const base = { sourceUrl: link.source_url, targetUrl: link.target_url, anchor, follow: link.is_dofollow, occurrences: 0, offset: null, excerpt: null };
    if (source.availability !== 'ok' || !source.text) { out.push({ ...base, status: 'source-unavailable' }); continue; }
    if (!anchor) { out.push({ ...base, status: 'no-anchor-text' }); continue; }
    const hits = occurrencesOf(source.text, anchor);
    if (!hits.length) { out.push({ ...base, status: 'not-found' }); continue; }
    out.push({
      ...base, status: hits.length === 1 ? 'located' : 'ambiguous', occurrences: hits.length,
      offset: hits[0], excerpt: excerptAt(source.text, hits[0], anchor.length),
    });
  }
  return out;
};
