import { normalizeSemanticText } from '@/services/semanticText';
import { HUB_MAX_WORDS_PER_LINK, HUB_MIN_LINKED_DOCUMENTS } from '@/services/topicalDiagnosis/thresholds';
import type { FocusPage, PageType } from './types';

export const TYPE_WEIGHT: Record<PageType, number> = { homepage: 3, category: 2, article: 1, technical: 0.1 };

/** Legal, account, contact and utility pages in the languages the app ships. */
const TECHNICAL_SEGMENT = new RegExp(`^(${[
  'privacy[a-z-]*', 'polityka[a-z-]*', 'regulamin[a-z-]*', 'terms[a-z-]*', 'cookies?[a-z-]*', 'rodo', 'gdpr', 'kontakt[a-z-]*',
  'contact[a-z-]*', 'o-nas', 'about', 'about-us', 'impressum', 'datenschutz', 'agb', 'mentions-legales', 'cgv', 'aviso-legal',
  'privacidad', 'politica[a-z-]*', 'login', 'logowanie', 'signin', 'sign-in', 'register', 'rejestracja', 'cart', 'koszyk',
  'checkout', 'zamowienie', 'account', 'my-account', 'konto', 'wishlist', 'search', 'szukaj', 'sitemap', 'mapa-strony',
].join('|')})$`);
const TECHNICAL_TITLE = /^(privacy|polityka|regulamin|terms|contact|kontakt|o nas|about us|login|logowanie|cookie|impressum|datenschutz|cart|koszyk|checkout)/;
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

/** Internal inlink counts and distinct crawled targets per page, from the pages' own links. */
export const linkGraph = (pages: FocusPage[]): { inlinks: Map<string, number>; targets: Map<string, number> } => {
  const known = new Set(pages.map((page) => normalizeUrl(page.final_url || page.url)));
  const inlinks = new Map<string, number>();
  const targets = new Map<string, number>();
  pages.forEach((page) => {
    const self = normalizeUrl(page.final_url || page.url);
    const seen = new Set<string>();
    page.links.filter((link) => link.is_internal).forEach((link) => {
      const target = normalizeUrl(link.target_url);
      if (target === self || seen.has(target) || !known.has(target)) return;
      seen.add(target);
      inlinks.set(target, (inlinks.get(target) ?? 0) + 1);
    });
    targets.set(self, seen.size);
  });
  return { inlinks, targets };
};

export interface TypeContext { startUrl: string; pageCount: number; graph: ReturnType<typeof linkGraph> }

export const classifyPage = (page: FocusPage, context: TypeContext): PageType => {
  const url = normalizeUrl(page.final_url || page.url);
  const segments = pathSegments(url);
  if (!segments.length || url === normalizeUrl(context.startUrl)) return 'homepage';
  const title = normalizeSemanticText(page.title ?? '');
  if (segments.some((segment) => TECHNICAL_SEGMENT.test(normalizeSemanticText(segment))) || TECHNICAL_TITLE.test(title)) return 'technical';
  const linked = context.graph.targets.get(url) ?? 0;
  const listing = linked >= HUB_MIN_LINKED_DOCUMENTS && page.word_count / linked < HUB_MAX_WORDS_PER_LINK;
  const popular = page.depth <= 1 && (context.graph.inlinks.get(url) ?? 0) >= Math.max(5, Math.ceil(context.pageCount * 0.15));
  return CATEGORY_SEGMENT.test(segments[segments.length - 1]) || segments.some((segment) => TAXONOMY_SEGMENT.test(segment)) || listing || popular ? 'category' : 'article';
};
