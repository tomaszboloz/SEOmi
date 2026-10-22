import type { FocusPage, PageFocus, SiteFocusReport } from '@/services/siteFocus';
import { prepare } from '@/services/siteFocus/evaluate';
import { normalizeUrl } from '@/services/siteFocus/pageType';
import { buildTermStats, phraseKey, tfidfVector } from '@/services/siteFocus/terms';

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

/** Analysed pages of a crawl joined with their Site Focus scores, vectors and heading keys. */
export const buildContext = (pages: FocusPage[], startUrl: string, report: SiteFocusReport): AuthorityContext => {
  const language = report.model.language || '';
  const items = prepare(pages, startUrl, language || undefined).filter((item) => !item.skipped);
  const stats = buildTermStats(items.map((item) => item.terms));
  const focusByUrl = new Map(report.pages.map((page) => [normalizeUrl(page.url), page]));
  const coreKeys = new Set(Object.entries(report.model.termCluster).filter(([, id]) => id === report.model.coreClusterId).map(([key]) => key));
  const out: AuthorityPage[] = [];
  items.forEach((item) => {
    const url = normalizeUrl(item.page.final_url || item.page.url);
    const focus = focusByUrl.get(normalizeUrl(item.page.url)) ?? focusByUrl.get(url);
    if (!focus || focus.skipped) return;
    const heads = item.page.heading_texts;
    const h1 = unigramKeys((heads?.h1 ?? []).join(' ') || item.page.title || '', language);
    const headings = [...(heads?.h2 ?? []), ...(heads?.h3 ?? [])].map((text) => unigramKeys(text, language));
    const zone = new Set([...unigramKeys(item.page.title ?? '', language), ...h1, ...headings.flatMap((set) => [...set])]);
    out.push({ url, page: item.page, focus, vector: tfidfVector(item.terms, stats), zone, h1, headings, keys: new Set(item.terms.entries.keys()), date: validDate(item.page.content_date) });
  });
  return { language, pages: out, byUrl: new Map(out.map((entry) => [entry.url, entry])), coreKeys };
};

/** Pages that count toward authority: on-topic (TRS >= 60) content pages. */
export const eligiblePages = (context: AuthorityContext): AuthorityPage[] =>
  context.pages.filter((entry) => entry.focus.trs >= 60 && entry.focus.type !== 'technical');
