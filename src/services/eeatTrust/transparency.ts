import type { CrawledPageSummary } from '@/types';
import { pathSegments } from '@/services/siteFocus/pageType';
import type { SchemaNode } from './graph';
import type { TransparencyDetail, TransparencyKind } from './types';

/** URL segments and title words that identify trust-building pages in the site's main languages. */
const PATTERNS: Record<TransparencyKind, RegExp> = {
  editorial: /(editorial|redakcyj|polityka-redak|metodolog|methodolog|fact-?check|weryfikacj|verification|redaktionell|politique-edit|politica-editorial|politica-redazion|редакцион)/i,
  about: /(^|[-/ ])(o-nas|about|about-us|over-ons|uber-uns|ueber-uns|qui-sommes|chi-siamo|sobre|quienes-somos|о-нас|会社|关于|소개|من-نحن)($|[-/ ])/i,
  contact: /(^|[-/ ])(kontakt|contact|contacto|contato|contatti|kontakte|контакт|お問い合わせ|联系|문의|اتصل)/i,
  registry: /((^|[-/ ])(krs|nip|regon)($|[-/ ])|impressum|imprint|mentions-legales|aviso-legal|note-legali|dane-firmy|dane-rejestrowe|company-(info|details|data)|legal-notice|stopka-prawna|регистрац|法的|公司信息)/i,
};

const KINDS = Object.keys(PATTERNS) as TransparencyKind[];

const DATE_PROPERTIES = ['dateModified', 'lastReviewed', 'datePublished'];

/** Which transparency pages exist in the crawl, and how many articles show a date. */
export const analyzeTransparency = (pages: CrawledPageSummary[], articleNodes: Map<string, SchemaNode[]>): TransparencyDetail => {
  const found: TransparencyDetail['found'] = { editorial: undefined, about: undefined, contact: undefined, registry: undefined };
  for (const page of pages) {
    if (page.http_status >= 400 || page.request_error_kind) continue;
    const url = page.final_url || page.url;
    const haystack = `${pathSegments(url).join('/')} ${page.title ?? ''}`;
    for (const kind of KINDS) if (!found[kind] && PATTERNS[kind].test(haystack)) found[kind] = url;
  }
  let datedArticles = 0;
  for (const articles of articleNodes.values()) {
    if (articles.some((node) => DATE_PROPERTIES.some((property) => node.props[property]?.length))) datedArticles += 1;
  }
  return { found, datedArticles, articles: articleNodes.size };
};

const WEIGHT: Record<TransparencyKind | 'dates', number> = { editorial: 0.25, contact: 0.2, registry: 0.2, about: 0.1, dates: 0.25 };

/** 0-100 from found trust pages (75%) and the share of dated articles (25%); a site without articles scores pages only. */
export const transparencyScore = (detail: TransparencyDetail): number | undefined => {
  if (!detail.articles && !Object.values(detail.found).some(Boolean)) return undefined;
  const pages = KINDS.reduce((sum, kind) => sum + (detail.found[kind] ? WEIGHT[kind] : 0), 0);
  if (!detail.articles) return Math.round((pages / (1 - WEIGHT.dates)) * 100);
  return Math.round((pages + WEIGHT.dates * (detail.datedArticles / detail.articles)) * 100);
};
