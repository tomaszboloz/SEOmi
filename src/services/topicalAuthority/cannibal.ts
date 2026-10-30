import { blendSimilarity, safeCosine } from '@/services/semanticSource/similarity';
import { cosine, jaccard, type AuthorityContext, type AuthorityPage } from './context';
import { PARTIAL_COSINE } from './coverage';
import type { CannibalEdge, CannibalGroup, SubtopicCoverage } from './types';

export const SAME_INTENT_COSINE = 0.88;
export const SAME_H1_JACCARD = 0.5;
export const PRE_PUBLISH_COSINE = 0.85;

const round1 = (value: number): number => Math.round(value * 10) / 10;

const unite = (parents: Map<string, string>, left: string, right: string): void => {
  const find = (key: string): string => { let root = key; while (parents.get(root) !== root) root = parents.get(root) as string; return root; };
  parents.set(find(left), find(right));
};

/** Share of Core Topic terms the smaller page has that the other one also uses. */
const sharedEntities = (left: AuthorityPage, right: AuthorityPage, context: AuthorityContext): number => {
  const a = [...left.keys].filter((key) => context.coreKeys.has(key));
  const b = new Set([...right.keys].filter((key) => context.coreKeys.has(key)));
  const small = Math.min(a.length, b.size);
  return small ? a.filter((key) => b.has(key)).length / small : 0;
};

/** Counts page pairs where an embedding similarity was really used (#86). */
export interface SimilarityUsage { pairs: number }

/**
 * TF-IDF cosine, blended with the page-embedding cosine when both pages have a valid vector.
 * Decision (default chosen by agent, #86): the mean, not the max, so an embedding can confirm but never on
 * its own push an unrelated pair over the cannibalization thresholds calibrated on TF-IDF.
 */
export const pairSimilarityOf = (a: AuthorityPage, b: AuthorityPage, usage?: SimilarityUsage): number => {
  const semantic = safeCosine(a.embedding, b.embedding);
  if (semantic !== null && usage) usage.pairs += 1;
  return blendSimilarity(cosine(a.vector, b.vector), semantic);
};

const canonicalOf = (members: AuthorityPage[], inbound: Map<string, number>): AuthorityPage =>
  [...members].sort((a, b) => b.focus.trs - a.focus.trs || (inbound.get(b.url) ?? 0) - (inbound.get(a.url) ?? 0) || b.keys.size - a.keys.size || (a.url < b.url ? -1 : 1))[0];

/**
 * Semantic cannibalization: two pages fight for one intent when their vectors match (cos >= 0.88) and their H1s agree,
 * or when both fully cover the same reference sub-topic and still read alike (cos >= 0.60).
 */
export const findCannibalization = (
  pages: AuthorityPage[], context: AuthorityContext, coverage: SubtopicCoverage[], inbound: Map<string, number>, usage?: SimilarityUsage,
): CannibalGroup[] => {
  const parents = new Map(pages.map((entry) => [entry.url, entry.url]));
  const pairSimilarity = new Map<string, number>();
  const topicOf = new Map<string, string>();
  const evidence: CannibalEdge[] = [];
  const note = (a: AuthorityPage, b: AuthorityPage, value: number, subtopic?: string): void => {
    unite(parents, a.url, b.url);
    pairSimilarity.set([a.url, b.url].sort().join('|'), value);
    const [from, to] = [a.url, b.url].sort();
    evidence.push({ from, to, similarity: round1(value * 100), basis: subtopic ? 'subtopic' : 'intent' });
    if (subtopic) topicOf.set(a.url, subtopic);
  };
  pages.forEach((a, index) => pages.slice(index + 1).forEach((b) => {
    const value = pairSimilarityOf(a, b, usage);
    if (value >= SAME_INTENT_COSINE && jaccard(a.h1, b.h1) >= SAME_H1_JACCARD) note(a, b, value);
  }));
  coverage.filter((row) => row.coverage === 1 && row.urls.length > 1).forEach((row) => {
    const members = row.urls.map((url) => context.byUrl.get(url)).filter((entry): entry is AuthorityPage => Boolean(entry) && pages.includes(entry as AuthorityPage));
    members.forEach((a, index) => members.slice(index + 1).forEach((b) => { const value = pairSimilarityOf(a, b, usage); if (value >= PARTIAL_COSINE) note(a, b, value, row.subtopicId); }));
  });
  const find = (key: string): string => { let root = key; while (parents.get(root) !== root) root = parents.get(root) as string; return root; };
  const buckets = new Map<string, AuthorityPage[]>();
  pages.forEach((entry) => buckets.set(find(entry.url), [...(buckets.get(find(entry.url)) ?? []), entry]));
  return [...buckets.values()].filter((members) => members.length > 1).map((members) => {
    const canonical = canonicalOf(members, inbound);
    const others = members.filter((entry) => entry !== canonical);
    const similarity = Math.max(...others.map((entry) => pairSimilarity.get([entry.url, canonical.url].sort().join('|')) ?? pairSimilarityOf(entry, canonical)));
    const shared = others.reduce((sum, entry) => sum + sharedEntities(entry, canonical, context), 0) / others.length;
    const subtopicId = members.map((entry) => topicOf.get(entry.url)).find(Boolean);
    return { urls: members.map((entry) => entry.url).sort(), canonical: canonical.url, similarity: round1(similarity * 100), sharedEntitiesPct: round1(shared * 100), edges: evidence.filter((edge) => members.some((entry) => entry.url === edge.from)).sort((a, b) => (a.from + a.to < b.from + b.to ? -1 : 1)), ...(subtopicId ? { subtopicId } : {}) };
  }).sort((a, b) => b.urls.length - a.urls.length || b.similarity - a.similarity || (a.canonical < b.canonical ? -1 : 1));
};

/** Semantic Cannibalization Index (0-100): pages that duplicate a canonical page, as a share of on-topic pages. */
export const cannibalizationIndex = (groups: CannibalGroup[], eligible: number): number =>
  eligible ? round1(Math.min(100, (groups.reduce((sum, group) => sum + group.urls.length - 1, 0) / eligible) * 100)) : 0;

/** Draft or new page against the live site: existing pages it overlaps with at or above 85%. */
export const overlapsWith = (draft: AuthorityPage, pages: AuthorityPage[]): Array<{ url: string; similarity: number }> =>
  pages.filter((entry) => entry.url !== draft.url).map((entry) => ({ url: entry.url, similarity: round1(cosine(draft.vector, entry.vector) * 100) }))
    .filter((row) => row.similarity >= PRE_PUBLISH_COSINE * 100).sort((a, b) => b.similarity - a.similarity || (a.url < b.url ? -1 : 1));
