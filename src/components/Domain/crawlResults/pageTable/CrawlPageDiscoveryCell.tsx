import React from 'react';
import type { CrawledPageSummary } from '@/types';
import type { TFunction } from 'i18next';
import { cell, discoverySourcesForPage } from '../crawlResultsHelpers';

interface CrawlPageDiscoveryCellProps {
  page: CrawledPageSummary;
  t: TFunction;
}

export const CrawlPageDiscoveryCell: React.FC<CrawlPageDiscoveryCellProps> = ({
  page,
  t,
}) => {
  const sources = discoverySourcesForPage(page);

  return (
    <td className={`${cell} max-w-64`}>
      {sources.length ? (
        <div className="space-y-1 text-[10px]">
          {sources.slice(0, 2).map((source, index) => (
            <div key={`${source.kind}-${source.source_url || 'none'}-${index}`}>
              <span className="font-medium text-sky-200">
                {t(`mapUi.discovery.${source.kind}`)}
              </span>
              {source.source_url && (
                <span
                  className="ml-1 break-all font-mono text-slate-500"
                  title={source.source_url}
                >
                  ← {source.source_url}
                </span>
              )}
              {source.anchor_text && (
                <span
                  className="block truncate text-slate-400"
                  title={source.anchor_text}
                >
                  „{source.anchor_text}”
                </span>
              )}
            </div>
          ))}
          {sources.length > 2 && (
            <span className="text-slate-500">
              {t('crawl.ui.moreSources', {
                count: sources.length - 2,
              })}
            </span>
          )}
        </div>
      ) : (
        <span className="text-[10px] text-slate-600">
          {t('crawl.ui.notSavedRun')}
        </span>
      )}
    </td>
  );
};
