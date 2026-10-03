import React from 'react';
import type { TFunction } from 'i18next';
import { CrawlSort, cell, tableHead } from '../crawlResultsHelpers';

interface CrawlPageTableHeaderProps {
  sort: CrawlSort;
  descending: boolean;
  setSort: (sort: CrawlSort) => void;
  setDescending: React.Dispatch<React.SetStateAction<boolean>>;
  crawlMode?: 'http' | 'browser-rendered';
  t: TFunction;
}

export const CrawlPageTableHeader: React.FC<CrawlPageTableHeaderProps> = ({
  sort,
  descending,
  setSort,
  setDescending,
  crawlMode,
  t,
}) => {
  const columns: Array<[string, string]> = [
    ['status', t('crawl.ui.status')],
    ['url', t('crawl.ui.url')],
    ['source', t('crawl.ui.source')],
    ['title', t('crawl.ui.title')],
    ['depth', t('crawl.ui.depth')],
    ['h1', t('uiUnits.headingLevel', { level: 1 })],
    ['words', t('crawl.ui.words')],
    ['complexity', t('crawl.ui.complexity')],
    ['readability', t('crawl.ui.readability')],
    [
      'timing',
      crawlMode === 'browser-rendered'
        ? t('crawl.ui.navigation')
        : t('crawl.ui.httpTime'),
    ],
    ['issues', t('crawl.ui.issues')],
    ['redirects', t('crawl.ui.redirects')],
  ];

  const sortKeys: Partial<Record<string, CrawlSort>> = {
    status: 'status',
    url: 'url',
    title: 'title',
    depth: 'depth',
    timing: 'responseTime',
    issues: 'issues',
  };

  return (
    <thead className={tableHead}>
      <tr>
        {columns.map(([column, label]) => {
          const key = sortKeys[column];
          return (
            <th
              key={column}
              className={cell}
              aria-sort={
                key
                  ? sort === key
                    ? descending
                      ? 'descending'
                      : 'ascending'
                    : 'none'
                  : undefined
              }
            >
              {key ? (
                <button
                  type="button"
                  onClick={() => {
                    if (sort === key) setDescending((value) => !value);
                    else {
                      setSort(key);
                      setDescending(false);
                    }
                  }}
                  className="font-semibold hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  {label}
                  {sort === key ? (descending ? ' ↓' : ' ↑') : ''}
                </button>
              ) : (
                label
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
};
