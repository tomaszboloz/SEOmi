import type { CrawledPageSummary } from '@/types';
import { normalizeGraphUrl } from '@/services/semanticGraph/urls';

/** `/blog/page/3/`, `/blog/strona/3`: pagination without `rel=prev` still belongs to its listing (`/p/123` is a product, not a page). */
export const PAGINATION_PATH = /^(.*?)\/(page|strona|seite|pagina)\/\d+\/?$/i;

export const paginationParent = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const match = PAGINATION_PATH.exec(parsed.pathname);
    if (!match) return null;
    parsed.pathname = `${match[1]}/`;
    parsed.search = '';
    return parsed.toString();
  } catch {
    return null;
  }
};

/** Query parameters that carry a page number; `?p=123` is a WordPress post id, not a page. */
const PAGE_PARAMETER = /^(page|paged|pg|strona|seite|pagina)$/i;

/** The listing a URL is one page of: the URL without its page number. Empty when the URL cannot be parsed. */
export const paginationBase = (url: string, base?: string): string => {
  try {
    const parsed = new URL(url, base);
    const match = PAGINATION_PATH.exec(parsed.pathname);
    if (match) parsed.pathname = `${match[1]}/`;
    [...parsed.searchParams.entries()]
      .filter(([name, value]) => PAGE_PARAMETER.test(name) && /^\d+$/.test(value))
      .forEach(([name]) => parsed.searchParams.delete(name));
    return normalizeGraphUrl(parsed.toString());
  } catch {
    return '';
  }
};

/**
 * `rel=prev|next` also joins neighbouring posts (the post navigation of
 * WordPress), so a declared neighbour is pagination only when both URLs are
 * pages of one listing. Returns the neighbour, or null.
 */
export const listingNeighbour = (page: CrawledPageSummary, target: string | null | undefined): string | null => {
  if (!target) return null;
  const listing = paginationBase(page.url);
  return listing !== '' && paginationBase(target, page.url) === listing ? target : null;
};

const pathOf = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
};

/** One page of a paginated listing, by its path or by a `rel=prev|next` neighbour of the same listing. */
export const isPaginationPage = (page: CrawledPageSummary): boolean => PAGINATION_PATH.test(pathOf(page.url))
  || listingNeighbour(page, page.pagination_prev) !== null || listingNeighbour(page, page.pagination_next) !== null;
