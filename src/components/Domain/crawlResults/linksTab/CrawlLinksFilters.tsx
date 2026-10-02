import React from 'react';
import type { TFunction } from 'i18next';
import { downloadText } from '@/services/export';
import {
  crawlLinksCsv,
  type CrawlLinkKindFilter,
  type CrawlLinkSort,
  type CrawlLinkStatusFilter,
} from '@/services/crawlLinkFilters';
import type { CrawlLinkRowItem } from './crawlLinksTabHelpers';

interface Props {
  linkQuery: string;
  setLinkQuery: (query: string) => void;
  linkKind: CrawlLinkKindFilter;
  setLinkKind: (kind: CrawlLinkKindFilter) => void;
  linkStatus: CrawlLinkStatusFilter;
  setLinkStatus: (status: CrawlLinkStatusFilter) => void;
  linkSort: CrawlLinkSort;
  setLinkSort: (sort: CrawlLinkSort) => void;
  linkDescending: boolean;
  setLinkDescending: (fn: (current: boolean) => boolean) => void;
  navigationRunId: string;
  links: CrawlLinkRowItem[];
  allLinks: CrawlLinkRowItem[];
  t: TFunction;
}

export const CrawlLinksFilters: React.FC<Props> = ({
  linkQuery,
  setLinkQuery,
  linkKind,
  setLinkKind,
  linkStatus,
  setLinkStatus,
  linkSort,
  setLinkSort,
  linkDescending,
  setLinkDescending,
  navigationRunId,
  links,
  allLinks,
  t,
}) => (
  <section
    className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
    aria-label={t('crawl.ui.linkFilters')}
  >
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid min-w-56 flex-1 gap-1 text-[11px] text-slate-400">
        {t('crawl.ui.searchLink')}
        <input
          aria-label={t('crawl.ui.searchLink')}
          value={linkQuery}
          onChange={(event) => setLinkQuery(event.target.value)}
          placeholder={t('crawl.ui.searchLinkPlaceholder')}
          className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
        />
      </label>
      <label className="grid gap-1 text-[11px] text-slate-400">
        {t('crawl.ui.type')}
        <select
          aria-label={t('crawl.ui.linkType')}
          value={linkKind}
          onChange={(event) =>
            setLinkKind(event.target.value as CrawlLinkKindFilter)
          }
          className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200"
        >
          <option value="all">{t('crawl.ui.all')}</option>
          <option value="internal">{t('crawl.ui.internalPlural')}</option>
          <option value="external">{t('crawl.ui.externalPlural')}</option>
        </select>
      </label>
      <label className="grid gap-1 text-[11px] text-slate-400">
        {t('crawl.ui.status')}
        <select
          aria-label={t('crawl.ui.linkStatus')}
          value={linkStatus}
          onChange={(event) =>
            setLinkStatus(event.target.value as CrawlLinkStatusFilter)
          }
          className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200"
        >
          <option value="all">{t('crawl.ui.all')}</option>
          <option value="unchecked">{t('crawl.ui.notChecked')}</option>
          <option value="ok">{t('crawl.customSearch.ok')}</option>
          <option value="redirect">{t('crawl.ui.redirect')}</option>
          <option value="error">{t('crawl.ui.error')}</option>
          <option value="blocked">{t('crawl.ui.blockedInvalid')}</option>
        </select>
      </label>
      <label className="grid gap-1 text-[11px] text-slate-400">
        {t('crawl.ui.sortBy')}
        <select
          aria-label={t('crawl.ui.linkSort')}
          value={linkSort}
          onChange={(event) =>
            setLinkSort(event.target.value as CrawlLinkSort)
          }
          className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200"
        >
          <option value="source">{t('crawl.ui.source')}</option>
          <option value="target">{t('crawl.ui.target')}</option>
          <option value="anchor">{t('crawl.ui.anchor')}</option>
          <option value="status">{t('crawl.ui.status')}</option>
        </select>
      </label>
      <button
        type="button"
        onClick={() => setLinkDescending((value) => !value)}
        aria-pressed={linkDescending}
        className="h-8 rounded-md border border-slate-700 px-2.5 text-[11px] text-slate-300 hover:bg-slate-800"
      >
        {linkDescending ? t('crawl.ui.descending') : t('crawl.ui.ascending')}
      </button>
      <button
        type="button"
        onClick={() =>
          downloadText(
            `seomi-crawl-links-${navigationRunId}.csv`,
            crawlLinksCsv(links),
            'text/csv',
          )
        }
        disabled={!links.length}
        className="h-8 rounded-md border border-slate-700 px-2.5 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40"
      >
        {t('crawl.ui.exportViewCsv')}
      </button>
    </div>
    <p className="mt-2 text-[10px] text-slate-500">
      {t('crawl.ui.linksShown', {
        visible: links.length,
        total: allLinks.length,
      })}
    </p>
  </section>
);
