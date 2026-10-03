import React from 'react';
import type { TFunction } from 'i18next';
import { CrawlSegment, CrawlSort } from '../crawlResultsHelpers';

interface CrawlUrlsSearchSortBarProps {
  query: string;
  setQuery: (query: string) => void;
  segment: CrawlSegment;
  setSegment: (segment: CrawlSegment) => void;
  sort: CrawlSort;
  setSort: (sort: CrawlSort) => void;
  descending: boolean;
  setDescending: React.Dispatch<React.SetStateAction<boolean>>;
  t: TFunction;
}

export const CrawlUrlsSearchSortBar: React.FC<CrawlUrlsSearchSortBarProps> = ({
  query,
  setQuery,
  segment,
  setSegment,
  sort,
  setSort,
  descending,
  setDescending,
  t,
}) => {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs text-slate-400">
        {t('crawl.ui.searchUrlTitle')}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('crawl.ui.searchLinkPlaceholder')}
          className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
        />
      </label>
      <label className="text-xs text-slate-400">
        {t('crawl.ui.httpSegment')}
        <select
          value={segment}
          onChange={(event) => setSegment(event.target.value as CrawlSegment)}
          className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
        >
          <option value="all">{t('legacyUi.overview.allStatuses')}</option>
          <option value="2xx">{t('crawl.ui.successStatuses')}</option>
          <option value="3xx">{t('crawl.ui.redirects')}</option>
          <option value="4xx">{t('crawl.ui.errorKinds.http')}</option>
          <option value="5xx">{t('crawl.ui.errorKinds.http')}</option>
          <option value="transport">{t('crawl.ui.transport')}</option>
        </select>
      </label>
      <label className="text-xs text-slate-400">
        {t('crawlDeepUi.sortBy')}
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as CrawlSort)}
          className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
        >
          <option value="url">{t('crawl.ui.url')}</option>
          <option value="status">{t('crawl.ui.httpStatusLabel')}</option>
          <option value="title">{t('crawl.ui.title')}</option>
          <option value="depth">{t('crawl.ui.depth')}</option>
          <option value="responseTime">{t('crawl.ui.responseTime')}</option>
          <option value="issues">{t('crawl.ui.issueCount')}</option>
        </select>
      </label>
      <div className="flex items-end">
        <button
          type="button"
          onClick={() => setDescending((value) => !value)}
          aria-pressed={descending}
          className="h-8 rounded-md border border-slate-700 px-2.5 text-xs text-slate-300 hover:border-emerald-400/50"
        >
          {descending
            ? `${t('crawl.ui.descending')} ↓`
            : `${t('crawl.ui.ascending')} ↑`}
        </button>
      </div>
    </div>
  );
};
