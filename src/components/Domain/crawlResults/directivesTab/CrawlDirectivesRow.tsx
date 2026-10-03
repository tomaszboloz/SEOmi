import React from 'react';
import type { TFunction } from 'i18next';
import type { CrawledPageSummary } from '@/types';
import { cell } from '../crawlResultsHelpers';

interface CrawlDirectivesRowProps {
  page: CrawledPageSummary;
  crawlMode?: string;
  t: TFunction;
}

export const CrawlDirectivesRow: React.FC<CrawlDirectivesRowProps> = ({
  page,
  crawlMode,
  t,
}) => {
  return (
    <tr className="border-t border-slate-800/80 text-slate-300">
      <td className={`${cell} max-w-64 truncate font-mono`} title={page.url}>
        {page.url}
      </td>
      <td className={`${cell} font-mono`}>
        {page.http_status || page.request_error_kind || '—'}
      </td>
      <td className={`${cell} max-w-48`}>{page.indexability_status}</td>
      <td className={`${cell} font-mono`}>
        {page.canonical_relation
          ? `${page.canonical_relation} · ${page.canonical_declaration_count ?? '—'}`
          : page.canonical
            ? t('crawlDeepUi.legacyUnavailable')
            : t('crawlDeepUi.legacyNoData')}
      </td>
      <td className={cell}>
        {page.canonical_targets?.length ? (
          <div className="max-w-[420px] space-y-1">
            {page.canonical_targets.map((target, index) => (
              <p key={`${target.url}-${index}`} className="break-all font-mono">
                <span className="text-slate-500">{target.relation} · </span>
                {target.url}
                <span className="ml-1 text-slate-400">
                  {target.checked_in_run
                    ? target.http_status === 0
                      ? `· ${t('crawlDeepUi.noResponse')}`
                      : `· ${t('crawl.ui.httpStatus', { status: target.http_status })}`
                    : `· ${t('crawlDeepUi.notCheckedThisRun')}`}
                </span>
              </p>
            ))}
          </div>
        ) : page.canonical ? (
          <span className="break-all font-mono">
            {page.canonical} · {t('crawlDeepUi.targetStatusUnavailable')} ·{' '}
            {t('crawlDeepUi.legacyUnavailable')}
          </span>
        ) : (
          <span className="text-slate-500">{t('crawl.ui.noCanonical')}</span>
        )}
      </td>
      <td className={cell}>
        {page.canonical_robots_conflict === undefined ? (
          t('crawlDeepUi.legacyNoData')
        ) : page.canonical_robots_conflict ? (
          <span className="text-amber-300">
            {t('crawlDeepUi.yes')} · {t('crawlDeepUi.canonicalNoindex')}
          </span>
        ) : (
          t('crawlDeepUi.notDetected')
        )}
      </td>
      <td className={cell}>{page.meta_robots || t('crawlDeepUi.noDirectives')}</td>
      <td className={cell}>
        {crawlMode === 'browser-rendered'
          ? t('crawlDeepUi.legacyUnavailable')
          : page.x_robots_tag || t('crawlDeepUi.noDirectives')}
      </td>
      <td className={`${cell} min-w-56`}>
        {page.robots_decision ? (
          <div className="space-y-1 text-[10px]">
            <p className="font-semibold text-sky-200">
              {page.robots_decision.indexability} · {page.robots_decision.link_following}
            </p>
            <p className="text-slate-400">
              {(page.robots_decision.directives || []).join(', ') || t('crawlDeepUi.defaults')}
            </p>
            <p className="text-slate-500">
              {t('crawl.ui.source')}:{' '}
              {(page.robots_decision.sources || []).join(', ') || t('crawlDeepUi.noDirectives')}
              {page.robots_decision.response_headers_available
                ? ` · ${t('crawlDeepUi.headersAvailable')}`
                : ` · ${t('crawlDeepUi.headersUnavailable')}`}
            </p>
          </div>
        ) : (
          <span className="text-slate-600">{t('crawl.ui.noDataOlderRun')}</span>
        )}
      </td>
    </tr>
  );
};
