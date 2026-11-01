import { normalizeSemanticText } from '@/services/semanticText';
import { UTILITY_SEGMENT_PATTERN } from '@/services/utilityPages';
import { looksLikeListing } from '@/services/topicalDiagnosis/thresholds';
import type { FocusPage, PageType } from './types';

export const TYPE_WEIGHT: Record<PageType, number> = { homepage: 3, category: 2, article: 1, technical: 0.1 };

const TECHNICAL_TITLE = /^(privacy|polityka|regulamin|terms|contact|kontakt|o nas|about us|login|logowanie|cookie|impressum|datenschutz|cart|koszyk|checkout|rodo|gdpr|kariera|career|jobs|reklama|register|rejestracja)/;
const CATEGORY_SEGMENT = /^(category|categories|kategoria|kategorie|tag|tags|temat|tematy|blog|produkty|products|shop|sklep|collections?|archiwum)$/;
const TAXONOMY_SEGMENT = /^(category|categories|kategoria|kategorie|tag|tags|temat|tematy|collections?)$/;

export const normalizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    const path = parsed.pathname.length > 1 ? parsed.pathname.replace(/\/+$/, '') : parsed.pathname;
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
  } catch {
    return url;
  }
};

export const pathSegments = (url: string): string[] => {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part).toLowerCase());
  } catch {
    return [];
  }
};

export interface LinkGraph {
  inlinks: Map<string, number>;
  /** Distinct crawled targets of the page's main content. */
  targets: Map<string, number>;
  /** Of those, targets at the page's own depth or deeper: what a category leads down to. */
  downward: Map<string, number>;
}

/** Internal inlink counts and own-content targets; footer and menu links (absent from semantic_links) do not make a page a hub. */
export const linkGraph = (pages: FocusPage[]): LinkGraph => {
  const depths = new Map(pages.map((page) => [normalizeUrl(page.final_url || page.url), page.depth] as const));
  const inlinks = new Map<string, number>();
  const targets = new Map<string, number>();
  const downward = new Map<string, number>();
  pages.forEach((page) => {
    const self = normalizeUrl(page.final_url || page.url);
    const seen = new Set<string>();
    page.links.filter((link) => link.is_internal).forEach((link) => {
      const target = normalizeUrl(link.target_url);
      if (target === self || !depths.has(target)) return;
      inlinks.set(target, (inlinks.get(target) ?? 0) + (seen.has(target) ? 0 : 1));
      seen.add(target);
    });
    const own = new Set<string>();
    (page.semantic_links ?? page.links).filter((link) => link.is_internal).forEach((link) => {
      const target = normalizeUrl(link.target_url);
      if (target !== self && depths.has(target)) own.add(target);
    });
    targets.set(self, own.size);
    downward.set(self, [...own].filter((target) => (depths.get(target) ?? 0) >= page.depth).length);
  });
  return { inlinks, targets, downward };
};

export interface TypeContext { startUrl: string; pageCount: number; graph: LinkGraph }

/** A category is a hub: it leads from its own content to several downward articles. A name or many inlinks alone do not make one. */
export const MIN_DOWNWARD_ARTICLES = 3;

export const classifyPage = (page: FocusPage, context: TypeContext): PageType => {
  const url = normalizeUrl(page.final_url || page.url);
  const segments = pathSegments(url);
  if (!segments.length || url === normalizeUrl(context.startUrl)) return 'homepage';
  const title = normalizeSemanticText(page.title ?? '');
  if (segments.some((segment) => UTILITY_SEGMENT_PATTERN.test(normalizeSemanticText(segment))) || TECHNICAL_TITLE.test(title)) return 'technical';
  if ((context.graph.downward.get(url) ?? 0) < MIN_DOWNWARD_ARTICLES) return 'article';
  const linked = context.graph.targets.get(url) ?? 0;
  const listing = looksLikeListing(page.word_count, linked);
  const popular = page.depth <= 1 && (context.graph.inlinks.get(url) ?? 0) >= Math.max(5, Math.ceil(context.pageCount * 0.15));
  return CATEGORY_SEGMENT.test(segments[segments.length - 1]) || segments.some((segment) => TAXONOMY_SEGMENT.test(segment)) || listing || popular ? 'category' : 'article';
};
