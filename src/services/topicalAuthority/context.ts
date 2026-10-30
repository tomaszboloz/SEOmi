import { buildSiteFocusReport, type FocusPage, type PageFocus, type SiteFocusReport } from '@/services/siteFocus';
import { applyGate } from '@/services/indexabilityGate';
import { prepare } from '@/services/siteFocus/evaluate';
import { normalizeUrl } from '@/services/siteFocus/pageType';
import { buildTermStats, phraseKey, tfidfVector } from '@/services/siteFocus/terms';
import { pageVectorFrom } from '@/services/semanticSource/similarity';
import type { EmbeddingSet } from '@/services/semanticSource/types';

export type Vector = Map<string, number>;

export interface AuthorityPage {
  url: string;
  page: FocusPage;
  focus: PageFocus;
  /** TF-IDF vector over all page n-grams. */
  vector: Vector;
  /** Unigram keys of title and H1-H3 (the page's declared topic). */
  zone: Set<string>;
  /** Unigram keys of H1 (title when absent). */
  h1: Set<string>;
  /** Unigram keys of H2-H3 headings, one set per heading. */
  headings: Array<Set<string>>;
  /** Every term key on the page. */
  keys: Set<string>;
  date?: string;
  /** Page vector from the shared embedding set (#86), when one was supplied and valid. */
  embedding?: ArrayLike<number>;
}

export interface AuthorityContext {
  language: string;
  pages: AuthorityPage[];
  byUrl: Map<string, AuthorityPage>;
  /** Term keys of the Core Topic cluster. */
  coreKeys: Set<string>;
}

const WORD = /[\p{L}\p{N}]+/gu;

/** Unigram keys of a free text; noise words drop out. */
export const unigramKeys = (text: string, language: string): Set<string> => {
  const keys = new Set<string>();
  (text.match(WORD) ?? []).forEach((word) => {
    const key = phraseKey(word, language);
    if (key) keys.add(key);
  });
  return keys;
};

export const cosine = (left: Vector, right: Vector): number => {
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  let dot = 0;
  small.forEach((value, key) => { dot += value * (large.get(key) ?? 0); });
  const norm = (vector: Vector): number => Math.sqrt([...vector.values()].reduce((sum, value) => sum + value * value, 0));
  const denominator = norm(left) * norm(right);
  return denominator > 0 ? dot / denominator : 0;
};

export const binary = (keys: Iterable<string>): Vector => new Map([...keys].map((key) => [key, 1]));

export const jaccard = (left: Set<string>, right: Set<string>): number => {
  const shared = [...left].filter((key) => right.has(key)).length;
  const union = left.size + right.size - shared;
  return union ? shared / union : 0;
};

const validDate = (value: string | undefined): string | undefined => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);

/** Rebuild the scoring model from the pages that pass the indexability gate. */
export const gatedSiteFocus = (
  pages: FocusPage[], startUrl: string, report: SiteFocusReport, embeddings?: EmbeddingSet,
): { pages: FocusPage[]; report: SiteFocusReport } => {
  const selected = new Set(report.pages.map((page) => normalizeUrl(page.url)).filter((url): url is string => Boolean(url)));
  const eligible = applyGate(pages).pages.filter((page) => [page.url, page.final_url].some((url) => {
    const key = normalizeUrl(url);
    return key !== null && selected.has(key);
  }));
  const manualTopic = report.coreTopic.manualOverride?.input.trim();
  // Re-request the same anchors (home is re-added by the resolver), so the gated model keeps the anchored Core.
  const anchorUrls = report.coreTopic.anchors ? [...report.coreTopic.anchors.sources, ...report.coreTopic.anchors.missing] : [];
  return {
    pages: eligible,
    report: buildSiteFocusReport(eligible, startUrl, {
      language: report.model.language || undefined,
      forceLexical: report.flags.fallbackMode === 'lexical',
      ...(embeddings ? { embeddings } : {}),
      now: report.generatedAt,
      ...(manualTopic ? { manualTopic } : {}),
      ...(anchorUrls.length ? { anchorUrls } : {}),
      // Same goal and brand dictionary as the source report: one Core Topic for every module (#82/#56).
      ...(report.coreTopic.businessGoal ? { businessGoal: report.coreTopic.businessGoal.input } : {}),
      ...(report.model.brand ? { brand: report.model.brand } : {}),
    }),
  };
};

const withEmbedding = (set: EmbeddingSet | undefined, url: string): { embedding?: ArrayLike<number> } => {
  const embedding = pageVectorFrom(set, url);
  return embedding ? { embedding } : {};
};

export const coreKeysOf = (report: SiteFocusReport): Set<string> =>
  new Set(Object.entries(report.model.termCluster).filter(([, id]) => id === report.model.coreClusterId).map(([key]) => key));

/** Analysed pages of a crawl joined with their Site Focus scores, vectors and heading keys. */
export const buildContext = (pages: FocusPage[], startUrl: string, report: SiteFocusReport, embeddings?: EmbeddingSet): AuthorityContext => {
  const scoped = gatedSiteFocus(pages, startUrl, report, embeddings);
  const language = scoped.report.model.language || '';
  const eligible = scoped.pages;
  const items = prepare(eligible, startUrl, language || undefined, scoped.report.model.brand).filter((item) => !item.skipped);
  const stats = buildTermStats(items.map((item) => item.terms));
  const focusByUrl = new Map(scoped.report.pages.map((page) => [normalizeUrl(page.url), page]));
  const coreKeys = coreKeysOf(scoped.report);
  const out: AuthorityPage[] = [];
  items.forEach((item) => {
    const url = normalizeUrl(item.page.final_url || item.page.url);
    const focus = focusByUrl.get(normalizeUrl(item.page.url)) ?? focusByUrl.get(url);
    if (!focus || focus.skipped) return;
    const heads = item.page.heading_texts;
    const h1 = unigramKeys((heads?.h1 ?? []).join(' ') || item.page.title || '', language);
    const headings = [...(heads?.h2 ?? []), ...(heads?.h3 ?? [])].map((text) => unigramKeys(text, language));
    const zone = new Set([...unigramKeys(item.page.title ?? '', language), ...h1, ...headings.flatMap((set) => [...set])]);
    out.push({ url, page: item.page, focus, vector: tfidfVector(item.terms, stats), zone, h1, headings, keys: new Set(item.terms.entries.keys()), date: validDate(item.page.content_date), ...withEmbedding(embeddings, url) });
  });
  return { language, pages: out, byUrl: new Map(out.map((entry) => [entry.url, entry])), coreKeys };
};

/** Pages that count toward authority: on-topic (TRS >= 60) content pages. */
export const eligiblePages = (context: AuthorityContext): AuthorityPage[] =>
  context.pages.filter((entry) => entry.focus.trs >= 60 && entry.focus.type !== 'technical');
