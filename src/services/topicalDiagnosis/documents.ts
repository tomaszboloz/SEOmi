import type { CrawledPageSummary } from '@/types';
import { normalizeGraphUrl, pageOwnersByUrl } from '@/services/semanticGraph/urls';
import {
  isSemanticNoiseTerm, isSemanticTopicalStatus, normalizeSemanticText, semanticPageLanguage,
  semanticPageTermEntries, semanticTermIdentity,
} from '@/services/semanticText';
import type { DiagnosisDocument } from './types';
import { MAX_DIAGNOSIS_PAGES } from './thresholds';
import { listingNeighbour, paginationParent } from './pagination';

export { PAGINATION_PATH, paginationParent } from './pagination';

/** Everything after a title separator is the site name, not the subject. */
export const TITLE_SEPARATOR = /\s[|—–-]\s.*$|\|.*$/u;
const LANGUAGE_SEGMENT = /^[a-z]{2}(-[a-z]{2})?$/i;
const isHtml = (page: CrawledPageSummary): boolean =>
  !page.content_type || page.content_type.toLowerCase().startsWith('text/html');

export const documentSection = (url: string): string => {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    if (segments.length && LANGUAGE_SEGMENT.test(segments[0])) segments.shift();
    return segments[0] ?? '(root)';
  } catch {
    return '(root)';
  }
};

export const titleTokens = (title: string | null | undefined, language: string | null | undefined) => {
  const seen = new Set<string>();
  return (title ?? '').replace(TITLE_SEPARATOR, '').split(/[^\p{L}\p{N}]+/u).flatMap((raw) => {
    const display = raw.normalize('NFKC').toLowerCase();
    const folded = normalizeSemanticText(display);
    if (display.length <= 2 || isSemanticNoiseTerm(folded)) return [];
    const key = semanticTermIdentity(folded, language);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ key, display }];
  });
};

const isRedirected = (page: CrawledPageSummary): boolean =>
  Boolean(page.final_url) && normalizeGraphUrl(page.final_url) !== normalizeGraphUrl(page.url);

/**
 * Union-find over page indexes: reciprocal hreflang pairs, pagination chains
 * and the aliases of one address (a redirect source crawled next to its
 * target, the same URL with and without a trailing slash) become one document.
 */
const groupPages = (pages: CrawledPageSummary[]) => {
  const owners = pageOwnersByUrl(pages);
  const firstRequest = new Map<string, number>();
  pages.forEach((page, index) => {
    const key = normalizeGraphUrl(page.url);
    if (!firstRequest.has(key)) firstRequest.set(key, index);
  });
  const indexOf = (url: string | null | undefined, base: string): number | null => {
    const id = owners.get(normalizeGraphUrl(url, base));
    return id ? Number(id.slice(5)) : null;
  };
  const root = pages.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (root[current] !== current) current = root[current];
    return current;
  };
  const union = (a: number, b: number) => {
    const [low, high] = [find(a), find(b)].sort((x, y) => x - y);
    if (low !== high) root[high] = low;
  };
  let mergedPairs = 0;
  pages.forEach((page, index) => {
    (page.hreflangs ?? []).forEach((entry) => {
      if (entry.language === 'x-default' || entry.reciprocal_in_run !== true) return;
      const other = indexOf(entry.target_url, page.url);
      if (other === null || other === index || find(other) === find(index)) return;
      union(index, other);
      mergedPairs += 1;
    });
    const previous = indexOf(listingNeighbour(page, page.pagination_prev) ?? paginationParent(page.url), page.url);
    if (previous !== null && previous !== index) union(index, previous);
    // The response of a redirected request is the content of its target, not a second document.
    [page.url, page.final_url].forEach((address) => {
      const alias = firstRequest.get(normalizeGraphUrl(address));
      if (alias !== undefined && alias !== index) union(index, alias);
    });
  });
  return { find, mergedPairs };
};

const startLanguage = (pages: CrawledPageSummary[], startUrl: string): string | null | undefined => {
  const start = normalizeGraphUrl(startUrl);
  const page = pages.find((candidate) => normalizeGraphUrl(candidate.url) === start || normalizeGraphUrl(candidate.final_url) === start);
  return page ? semanticPageLanguage(page) : undefined;
};

/** Sites usually serve the default language without a path prefix. */
const hasLanguagePrefix = (url: string): boolean => {
  try {
    return LANGUAGE_SEGMENT.test(new URL(url).pathname.split('/').filter(Boolean)[0] ?? '');
  } catch {
    return false;
  }
};

const buildDocument = (group: number[], pages: CrawledPageSummary[], language: string | null | undefined): DiagnosisDocument => {
  // The first page of a pagination chain leads and a redirect source never does; otherwise crawl order.
  const isPaginated = (index: number) => listingNeighbour(pages[index], pages[index].pagination_prev) !== null || paginationParent(pages[index].url) !== null;
  const members = [...group].sort((a, b) => Number(isPaginated(a)) - Number(isPaginated(b))
    || Number(isRedirected(pages[a])) - Number(isRedirected(pages[b])) || a - b);
  const memberPages = members.map((index) => pages[index]);
  const primaryIndex = (language ? members.find((index) => semanticPageLanguage(pages[index]) === language) : undefined)
    ?? members.find((index) => !hasLanguagePrefix(pages[index].url)) ?? members[0];
  const primaryPage = pages[primaryIndex];
  const titleForms = new Map<string, string>();
  [primaryPage, ...memberPages.filter((page) => page !== primaryPage)].forEach((page) =>
    titleTokens(page.title, semanticPageLanguage(page)).forEach(({ key, display }) => { if (!titleForms.has(key)) titleForms.set(key, display); }));
  return {
    id: `doc-${primaryIndex}`,
    pages: memberPages,
    primaryPage,
    urls: new Set(memberPages.flatMap((page) => [normalizeGraphUrl(page.url), normalizeGraphUrl(page.final_url)]).filter(Boolean)),
    languages: [...new Set(memberPages.map((page) => semanticPageLanguage(page)).filter((value): value is string => Boolean(value)))].sort(),
    terms: new Set(memberPages.flatMap((page) => semanticPageTermEntries(page).map((entry) => entry.key))),
    titleTerms: new Set(titleForms.keys()),
    titleForms,
    section: documentSection(primaryPage.url),
    role: 'content',
    // Only a truncated body weakens link and term evidence; reaching the 40-term cap is normal for long articles.
    partialEvidence: memberPages.some((page) => page.body_truncated === true),
  };
};

export const buildDiagnosisDocuments = (
  inputPages: CrawledPageSummary[], startUrl: string,
): { documents: DiagnosisDocument[]; skippedPages: number; mergedPairs: number } => {
  const bounded = inputPages.slice(0, MAX_DIAGNOSIS_PAGES);
  const pages = bounded.filter((page) => isHtml(page) && isSemanticTopicalStatus(page.http_status));
  const { find, mergedPairs } = groupPages(pages);
  const groups = new Map<number, number[]>();
  pages.forEach((_, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) ?? []), index]);
  });
  const language = startLanguage(pages, startUrl);
  const documents = [...groups.values()].map((group) => buildDocument(group, pages, language))
    .sort((a, b) => Number(a.id.slice(4)) - Number(b.id.slice(4)));
  return { documents, skippedPages: bounded.length - pages.length, mergedPairs };
};
