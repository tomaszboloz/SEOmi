import React from 'react';
import type { TFunction } from 'i18next';
import { Code2 } from 'lucide-react';
import { cell, tableHead } from '../crawlResultsHelpers';
import { Empty, Table } from '../CrawlViewPrimitives';
import { type CrawlLinkRowItem, getLinkStatusDisplay } from './crawlLinksTabHelpers';

interface Props {
  links: CrawlLinkRowItem[];
  linkEvidence?: { source: string; target: string };
  linkEvidenceHref: (sourceUrl: string, targetUrl: string) => string;
  copiedLinkSourceKey: string | null;
  copyLinkSource: (key: string, source: string) => Promise<void>;
  t: TFunction;
}

export const CrawlLinksTable: React.FC<Props> = ({
  links,
  linkEvidence,
  linkEvidenceHref,
  copiedLinkSourceKey,
  copyLinkSource,
  t,
}) => {
  if (!links.length) {
    return <Empty>{t('crawl.ui.noLinks')}</Empty>;
  }

  const tableHeaders = [
    t('crawl.ui.sourceUrl'),
    t('crawl.ui.type'),
    t('crawl.ui.targetStatus'),
    t('crawl.ui.anchor'),
    t('crawl.ui.target'),
    t('crawl.ui.rel'),
  ];

  return (
    <Table minWidth="min-w-[900px]">
      <thead className={tableHead}>
        <tr>
          {tableHeaders.map((label) => (
            <th key={label} className={cell}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {links.map(({ sourceUrl, link, key }) => {
          const { status, statusColorClass } = getLinkStatusDisplay(link, t);
          const isHighlighted =
            linkEvidence?.source === sourceUrl &&
            linkEvidence.target === link.target_url;

          return (
            <tr
              key={key}
              data-crawl-link-row
              data-source-url={sourceUrl}
              data-target-url={link.target_url}
              className={`border-t border-slate-800/80 text-slate-300 ${isHighlighted ? 'bg-emerald-500/10 ring-1 ring-inset ring-emerald-400/40' : ''}`}
            >
              <td className={`${cell} max-w-72 font-mono`} title={sourceUrl}>
                <a
                  href={linkEvidenceHref(sourceUrl, link.target_url)}
                  className="block truncate text-sky-200 underline-offset-2 hover:text-sky-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  title={t('crawl.ui.openLinkEvidence')}
                >
                  {sourceUrl}
                </a>
                {link.source_excerpt ? (
                  <details className="mt-1 max-w-72 font-sans">
                    <summary className="flex cursor-pointer items-center gap-1 text-[10px] text-sky-200">
                      <Code2 className="h-3 w-3" aria-hidden="true" />
                      {t('crawl.ui.showSourceCode')}
                    </summary>
                    <div className="mt-1 rounded-md border border-slate-800 bg-slate-950/80 p-2">
                      <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-4 text-slate-400">
                        {link.source_excerpt}
                      </pre>
                      <button
                        type="button"
                        onClick={() => void copyLinkSource(key, link.source_excerpt || '')}
                        className="mt-1 rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-emerald-400/50 hover:text-emerald-200"
                      >
                        {copiedLinkSourceKey === key ? t('crawl.ui.copied') : t('crawl.ui.copyCode')}
                      </button>
                    </div>
                  </details>
                ) : (
                  <span className="text-[10px] font-sans text-slate-600">
                    {t('crawl.ui.noExcerptOlderRun')}
                  </span>
                )}
              </td>
              <td className={cell}>
                {link.is_internal ? t('crawl.ui.internal') : t('crawl.ui.external')}
              </td>
              <td className={`${cell} font-mono ${statusColorClass}`}>
                <span>{status}</span>
                {link.target_redirect_url && (
                  <div className="mt-1 max-w-48 truncate text-[10px] text-amber-300" title={link.target_redirect_url}>
                    → {link.target_redirect_url}
                  </div>
                )}
                {link.target_response_time_ms !== undefined && (
                  <div className="mt-1 text-[10px] text-slate-500">
                    {link.target_response_time_ms} {t('performance.milliseconds')}
                  </div>
                )}
              </td>
              <td className={`${cell} max-w-48 truncate`} title={link.anchor_text}>
                {link.anchor_text || '—'}
              </td>
              <td className={`${cell} max-w-64 truncate font-mono`} title={link.target_url}>
                {link.target_url}
              </td>
              <td className={cell}>{link.rel || '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
};
