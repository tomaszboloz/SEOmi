import type { TFunction } from 'i18next';
import type { CrawledPageSummary, CrawledLink } from '@/types';
import {
  filterAndSortCrawlLinks,
  type CrawlLinkKindFilter,
  type CrawlLinkSort,
  type CrawlLinkStatusFilter,
} from '@/services/crawlLinkFilters';
import { normalizeLinkUrl } from '../crawlResultsHelpers';

export interface CrawlLinkRowItem {
  sourceUrl: string;
  link: CrawledLink;
  key: string;
}

interface ComputeCrawlLinksParams {
  pages: CrawledPageSummary[];
  query: string;
  kind: CrawlLinkKindFilter;
  status: CrawlLinkStatusFilter;
  sort: CrawlLinkSort;
  descending: boolean;
}

export const getLinkStatusDisplay = (link: CrawledLink, t: TFunction) => {
  const status =
    link.target_http_status !== undefined
      ? t('crawl.ui.httpStatus', { status: link.target_http_status })
      : link.target_request_error_kind === 'blocked'
        ? t('crawl.ui.blockedPrivateAddress')
        : link.target_request_error_kind === 'invalid'
          ? t('crawl.ui.invalidAddress')
          : link.target_request_error_kind
            ? t('crawl.ui.requestError', { kind: link.target_request_error_kind })
            : t('crawl.ui.notChecked');

  const hasRequestFailure = Boolean(
    link.target_request_error_kind &&
    link.target_request_error_kind !== 'blocked',
  );

  const statusColorClass =
    (link.target_http_status !== undefined && link.target_http_status >= 400) || hasRequestFailure
      ? 'text-rose-300'
      : link.target_http_status !== undefined && link.target_http_status >= 300
        ? 'text-amber-300'
        : link.target_checked_at && link.target_request_error_kind !== 'blocked'
          ? 'text-emerald-300'
          : 'text-slate-400';

  return { status, hasRequestFailure, statusColorClass };
};

export const computeCrawlLinksData = ({
  pages,
  query,
  kind,
  status,
  sort,
  descending,
}: ComputeCrawlLinksParams) => {
  const allLinks: CrawlLinkRowItem[] = pages.flatMap((page) =>
    page.links.map((link, index) => ({
      sourceUrl: page.url,
      link,
      key: `${page.url}-${link.target_url}-${index}`,
    })),
  );

  const links = filterAndSortCrawlLinks(allLinks, {
    query,
    kind,
    status,
    sort,
    descending,
  });

  const internalLinks = allLinks.filter(({ link }) => link.is_internal);
  const uniqueInternalTargets = new Set(
    internalLinks.map(({ link }) => normalizeLinkUrl(link.target_url)),
  );
  const checkedInternalTargets = new Set(
    internalLinks
      .filter(({ link }) => link.target_http_status !== undefined)
      .map(({ link }) => normalizeLinkUrl(link.target_url)),
  );
  const brokenInternalTargets = new Set(
    internalLinks
      .filter(
        ({ link }) =>
          link.target_http_status !== undefined &&
          (link.target_http_status === 0 || link.target_http_status >= 400),
      )
      .map(({ link }) => normalizeLinkUrl(link.target_url)),
  );
  const uncheckedInternalCount = Math.max(
    0,
    uniqueInternalTargets.size - checkedInternalTargets.size,
  );

  const externalLinks = allLinks.filter(({ link }) => !link.is_internal);
  const uncheckedExternalCount = new Set(
    externalLinks
      .filter(({ link }) => !link.target_checked_at)
      .map(({ link }) => normalizeLinkUrl(link.target_url)),
  ).size;
  const checkedExternalCount = new Set(
    externalLinks
      .filter(
        ({ link }) =>
          link.target_checked_at &&
          !['blocked', 'invalid'].includes(
            link.target_request_error_kind || '',
          ),
      )
      .map(({ link }) => normalizeLinkUrl(link.target_url)),
  ).size;
  const blockedExternalCount = new Set(
    externalLinks
      .filter(({ link }) => link.target_request_error_kind === 'blocked')
      .map(({ link }) => normalizeLinkUrl(link.target_url)),
  ).size;
  const invalidExternalCount = new Set(
    externalLinks
      .filter(({ link }) => link.target_request_error_kind === 'invalid')
      .map(({ link }) => normalizeLinkUrl(link.target_url)),
  ).size;

  return {
    allLinks,
    links,
    internalLinks,
    uniqueInternalTargets,
    checkedInternalTargets,
    brokenInternalTargets,
    uncheckedInternalCount,
    externalLinks,
    uncheckedExternalCount,
    checkedExternalCount,
    blockedExternalCount,
    invalidExternalCount,
  };
};
