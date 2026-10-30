import type { PageAuditData } from '@/types';
import type { ContentGapTopic } from './types';

const MAX_TOPIC_TEXT = 50_000;
const MAX_TOPIC_TOKENS = 4_000;
const STOP_WORDS = new Set('a an and are as at be by for from in is it of on or the this to with oraz i w z na do dla że jak jest nie się o od pod nad po za'.split(' '));
export const tokenList = (text: string): string[] => (text.slice(0, MAX_TOPIC_TEXT).toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) ?? []).filter((token) => !STOP_WORDS.has(token)).slice(0, MAX_TOPIC_TOKENS);
const excerpt = (text: string, term: string): string => {
  const bounded = text.slice(0, MAX_TOPIC_TEXT);
  const at = bounded.toLocaleLowerCase().indexOf(term);
  return `${at > 60 ? '…' : ''}${bounded.slice(Math.max(0, at - 60), Math.min(bounded.length, at + term.length + 100))}${at + term.length + 100 < bounded.length ? '…' : ''}`;
};
export const auditText = (audit: PageAuditData): string => [
  audit.meta_tags?.title ?? '',
  ...(audit.headings?.h1_texts ?? []),
  audit.content_stats?.body_text ?? '',
].filter(Boolean).join(' ');

export const buildTopics = (pages: Array<{ rank: number; url: string; text: string }>, availablePages: number, targetCounts: Map<string, number> | null): ContentGapTopic[] => {
  if (!availablePages) return [];
  const perPage = pages.map((page) => {
    const counts = new Map<string, number>();
    tokenList(page.text).forEach((term) => counts.set(term, (counts.get(term) ?? 0) + 1));
    return { ...page, counts };
  });
  const counts = new Map<string, { pages: number; total: number; evidence: Array<{ rank: number; url: string; excerpt: string }> }>();
  perPage.forEach((page) => page.counts.forEach((total, term) => {
    const current = counts.get(term) || { pages: 0, total: 0, evidence: [] };
    current.pages += 1;
    current.total += total;
    if (current.evidence.length < 4) current.evidence.push({ rank: page.rank, url: page.url, excerpt: excerpt(page.text, term) });
    counts.set(term, current);
  }));
  return [...counts.entries()].sort((left, right) => right[1].pages - left[1].pages || right[1].total - left[1].total || left[0].localeCompare(right[0])).slice(0, 30).map(([term, value]) => {
    const share = value.pages / availablePages;
    const targetOccurrences = targetCounts ? (targetCounts.get(term) ?? 0) : null;
    const targetPresent = targetCounts ? targetOccurrences! > 0 : null;
    return { term, observedPages: value.pages, availablePages, share, targetOccurrences, targetPresent, status: targetCounts ? (targetPresent ? 'covered' : 'gap') : 'unknown', evidence: value.evidence };
  });
};
