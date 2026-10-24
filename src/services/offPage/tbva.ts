import type { Vector } from '@/services/embeddings/types';
import { cosine } from '@/services/embeddings/vector';
import { usableVector } from './sources';

export interface OffPageLink {
  sourceUrl: string;
  /** Provider authority; its scale must be stated in options.scale. */
  authority: number | null;
  follow: boolean;
  /** Embedding of the source page text, or null when the text was not fetched. */
  vector: Vector | null;
}

export interface TbvaOptions {
  /** Maximum of the provider authority scale, for example 100. */
  scale: number;
  topic: Vector | null;
}

export interface TbvaReport {
  status: 'ready' | 'partial' | 'unavailable';
  /** Sum of normalized authority times topical similarity over counted links. */
  tbva: number | null;
  counted: number;
  nofollow: number;
  /** Links dropped because another link from the same domain already counted (best link wins). */
  duplicateDomains: number;
  unscored: number;
  /** Share of follow links that could be scored; absence of data is not zero backlinks. */
  coverage: number | null;
  limitations: string[];
}

const domainOf = (url: string): string => {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return url.toLowerCase(); }
};

const weight = (link: OffPageLink, topic: Vector, scale: number): number | null => {
  if (!usableVector(link.vector) || link.authority === null || !Number.isFinite(link.authority) || link.vector.length !== topic.length) return null;
  const auth = Math.min(1, Math.max(0, link.authority / scale));
  return auth * Math.max(0, cosine(link.vector, topic));
};

/** TBVA = sum(Auth(link) * max(0, cos(source, topic))). One counted link per source domain. Not Google PageRank. */
export const computeTbva = (links: OffPageLink[], options: TbvaOptions): TbvaReport => {
  const limitations: string[] = [];
  const follow = links.filter((l) => l.follow);
  const base = { nofollow: links.length - follow.length, duplicateDomains: 0, counted: 0, unscored: 0, coverage: null, tbva: null };
  if (!usableVector(options.topic)) return { ...base, status: 'unavailable', limitations: ['no-topic-vector'] };
  if (!Number.isFinite(options.scale) || !(options.scale > 0)) return { ...base, status: 'unavailable', limitations: ['invalid-scale'] };
  if (!follow.length) return { ...base, status: 'unavailable', limitations: ['no-follow-links'] };
  const best = new Map<string, number>();
  let unscored = 0;
  let duplicates = 0;
  follow.forEach((link) => {
    const w = weight(link, options.topic as Vector, options.scale);
    if (w === null) { unscored += 1; return; }
    const domain = domainOf(link.sourceUrl);
    if (best.has(domain)) duplicates += 1;
    best.set(domain, Math.max(best.get(domain) ?? 0, w));
  });
  if (unscored) limitations.push('source-text-or-authority-missing');
  if (!best.size) return { ...base, status: 'unavailable', unscored, coverage: 0, limitations };
  const total = [...best.values()].reduce((s, v) => s + v, 0);
  return { status: unscored ? 'partial' : 'ready', tbva: Math.round(total * 1000) / 1000, counted: best.size, nofollow: base.nofollow, duplicateDomains: duplicates, unscored, coverage: (follow.length - unscored) / follow.length, limitations };
};
