import type { CrawledLink } from '@/types';
import i18n from '@/i18n';
import { csv } from './export/csv';

export type CrawlLinkKindFilter = 'all' | 'internal' | 'external';
export type CrawlLinkStatusFilter =
  | 'all' | 'unchecked' | 'ok' | 'redirect' | 'broken' | 'unverifiable'
  // Kept for saved filters from releases before the verification split.
  | 'error' | 'blocked';
export type CrawlLinkSort = 'source' | 'target' | 'anchor' | 'status';

export interface CrawlLinkRecord {
  sourceUrl: string;
  link: CrawledLink;
  key: string;
}

export interface CrawlLinkFilters {
  query: string;
  kind: CrawlLinkKindFilter;
  status: CrawlLinkStatusFilter;
  sort: CrawlLinkSort;
  descending: boolean;
}

export const crawlLinkStatus = (link: CrawledLink): CrawlLinkStatusFilter => {
  const error = link.target_request_error_kind;
  if (error === 'dns' || error === 'broken') return 'broken';
  if (error) return 'unverifiable';
  if (link.target_http_status === 404 || link.target_http_status === 410) return 'broken';
  if (link.target_http_status !== undefined && link.target_http_status >= 400) return 'unverifiable';
  if ((link.target_http_status !== undefined && link.target_http_status >= 300) || link.target_redirect_url) return 'redirect';
  if (link.target_http_status !== undefined && link.target_http_status >= 200) return 'ok';
  return 'unchecked';
};

const matchesStatus = (actual: CrawlLinkStatusFilter, selected: CrawlLinkStatusFilter): boolean =>
  selected === 'error' ? actual === 'broken' : selected === 'blocked' ? actual === 'unverifiable' : actual === selected;

export const filterAndSortCrawlLinks = (records: CrawlLinkRecord[], filters: CrawlLinkFilters): CrawlLinkRecord[] => {
  const needle = filters.query.trim().toLocaleLowerCase();
  return records
    .filter(({ link }) => filters.kind === 'all' || (filters.kind === 'internal' ? link.is_internal : !link.is_internal))
    .filter(({ link }) => filters.status === 'all' || matchesStatus(crawlLinkStatus(link), filters.status))
    .filter(({ sourceUrl, link }) => !needle || [sourceUrl, link.target_url, link.anchor_text, link.rel, link.source_excerpt, link.target_http_status, link.target_request_error_kind, link.target_redirect_url]
      .some((value) => String(value ?? '').toLocaleLowerCase().includes(needle)))
    .sort((left, right) => {
      const leftValue = filters.sort === 'source' ? left.sourceUrl
        : filters.sort === 'anchor' ? left.link.anchor_text
          : filters.sort === 'status' ? `${crawlLinkStatus(left.link)} ${left.link.target_http_status ?? ''}`
            : left.link.target_url;
      const rightValue = filters.sort === 'source' ? right.sourceUrl
        : filters.sort === 'anchor' ? right.link.anchor_text
          : filters.sort === 'status' ? `${crawlLinkStatus(right.link)} ${right.link.target_http_status ?? ''}`
            : right.link.target_url;
      const compared = leftValue.localeCompare(rightValue, undefined, { sensitivity: 'base', numeric: true });
      return filters.descending ? -compared : compared;
    });
};

export const crawlLinksCsv = (records: CrawlLinkRecord[]): string => {
  const headers = i18n.t('exportUi.headers.crawlLinksFiltered', { returnObjects: true });
  const rows: unknown[][] = [Array.isArray(headers) ? headers.map(String) : []];
  records.forEach(({ sourceUrl, link }) => rows.push([
    sourceUrl,
    link.is_internal ? i18n.t('exportUi.statuses.internal') : i18n.t('exportUi.statuses.external'),
    link.target_url,
    link.target_http_status ?? '',
    link.target_request_error_kind ?? '',
    link.target_redirect_url ?? '',
    link.target_response_time_ms ?? '',
    link.target_checked_at ?? '',
    link.anchor_text,
    link.rel ?? '',
    link.source_excerpt ?? '',
  ]));
  return csv(rows);
};
