import type { CrawledPageSummary } from '@/types';
import { ruleKey } from './rules';
import type { RedirectRule } from './types';

export interface MergeCandidate {
  url: string;
  trs: number | null;
  depth: number;
  inlinks: number;
  /** GSC clicks (#59); null when no GSC data. */
  clicks: number | null;
}

export interface MergingBlueprint {
  winner: string;
  /** Per losing URL: H2s missing from the winner, and pages that still link to it. */
  merges: Array<{ url: string; h2ToMove: string[]; linkersToUpdate: string[] }>;
  rules: RedirectRule[];
}

const norm = (value: number, max: number) => (max > 0 ? value / max : 0);

/** Winner = highest weighted TRS, shallow depth, inlinks and GSC clicks. Ties resolve by URL, so output is stable. */
export const pickWinner = (candidates: MergeCandidate[]): string => {
  const max = (pick: (c: MergeCandidate) => number) => Math.max(0, ...candidates.map(pick));
  const maxTrs = max((c) => c.trs ?? 0); const maxIn = max((c) => c.inlinks); const maxClicks = max((c) => c.clicks ?? 0);
  const maxDepth = max((c) => c.depth);
  const score = (c: MergeCandidate) => 0.4 * norm(c.trs ?? 0, maxTrs) + 0.2 * (maxDepth > 0 ? 1 - c.depth / maxDepth : 1) + 0.2 * norm(c.inlinks, maxIn) + 0.2 * norm(c.clicks ?? 0, maxClicks);
  return [...candidates].sort((a, b) => score(b) - score(a) || (a.url < b.url ? -1 : 1))[0].url;
};

export const buildMergingBlueprint = (candidates: MergeCandidate[], pages: CrawledPageSummary[]): MergingBlueprint | null => {
  if (candidates.length < 2) return null;
  const winner = pickWinner(candidates);
  const byUrl = new Map(pages.map((page) => [ruleKey(page.final_url || page.url), page]));
  const winnerH2 = new Set((byUrl.get(ruleKey(winner))?.heading_texts?.h2 ?? []).map((h) => h.trim().toLocaleLowerCase()));
  const losers = candidates.filter((c) => c.url !== winner);
  const merges = losers.map(({ url }) => ({
    url,
    h2ToMove: (byUrl.get(ruleKey(url))?.heading_texts?.h2 ?? []).filter((h) => !winnerH2.has(h.trim().toLocaleLowerCase())),
    linkersToUpdate: pages.filter((page) => page.links.some((l) => l.is_internal && ruleKey(l.target_url) === ruleKey(url))).map((page) => page.url).sort(),
  }));
  return { winner, merges, rules: losers.map(({ url }) => ({ from: url, to: winner, status: 301 as const })) };
};
