import React from 'react';
import { cell, tableHead } from '../crawlResultsHelpers';
import { Empty, Table } from '../CrawlViewPrimitives';
import type { DirectivesSession, CrawlClientRedirectItem } from './directivesTabTypes';

interface CrawlClientRedirectsSectionProps {
  session: DirectivesSession;
}

export const CrawlClientRedirectsSection: React.FC<CrawlClientRedirectsSectionProps> = ({
  session,
}) => {
  const { result, t } = session;

  const redirectMechanism = (source: string): string => {
    const keyBySource: Record<string, string> = {
      'meta-refresh': 'crawlDeepUi.mechanismMetaRefresh',
      'http-refresh': 'crawlDeepUi.mechanismHttpRefresh',
      javascript: 'crawlDeepUi.mechanismJavascript',
      'javascript-inline': 'crawlDeepUi.mechanismJavascriptInline',
    };
    const key = keyBySource[source];
    return key ? t(key, { defaultValue: source }) : source;
  };

  const redirects: CrawlClientRedirectItem[] = result.pages.flatMap((page) =>
    (page.client_redirects || []).map((redirect, index) => ({
      page,
      redirect,
      key: `${page.url}-${redirect.source}-${index}`,
    })),
  );

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {t('crawlDeepUi.clientRedirects', { count: redirects.length })}
      </h3>
      {redirects.length ? (
        <Table minWidth="min-w-[900px]">
          <thead className={tableHead}>
            <tr>
              {[
                t('crawlDeepUi.sourceUrl'),
                t('crawlDeepUi.mechanism'),
                t('crawlDeepUi.delay'),
                t('crawlDeepUi.declaration'),
                t('crawlDeepUi.resolvedHttpTarget'),
              ].map((label) => (
                <th key={label} className={cell}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {redirects.map(({ page, redirect, key }) => (
              <tr key={key} className="border-t border-slate-800/80 text-slate-300">
                <td className={`${cell} max-w-64 truncate font-mono`} title={page.url}>
                  {page.url}
                </td>
                <td className={cell}>{redirectMechanism(redirect.source)}</td>
                <td className={`${cell} font-mono`}>
                  {redirect.delay_seconds === undefined || redirect.delay_seconds === null
                    ? t('crawlDeepUi.undetermined')
                    : `${redirect.delay_seconds} s`}
                </td>
                <td className={`${cell} max-w-72 break-all font-mono`}>
                  {redirect.declaration}
                </td>
                <td className={`${cell} max-w-72 break-all font-mono`}>
                  {redirect.target_url || t('crawlDeepUi.noValidHttpTarget')}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>{t('crawlDeepUi.noClientRedirects')}</Empty>
      )}
    </section>
  );
};
