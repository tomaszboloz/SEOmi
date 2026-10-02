import React from 'react';
import { cell } from '../crawlResultsHelpers';
import type { Session } from './internationalTabTypes';
import type { CrawledPageSummary } from '@/types';
import { CrawlHreflangList } from './CrawlHreflangList';

interface CrawlInternationalRowProps {
  page: CrawledPageSummary;
  t: Session['t'];
}

export const CrawlInternationalRow: React.FC<CrawlInternationalRowProps> = ({ page, t }) => {
  const ampStatus = !page.amp_url
    ? t('crawlDeepUi.noDirectives')
    : page.amp_target_checked_in_run
    ? page.amp_target_http_status == null
      ? t('crawlDeepUi.noResponse')
      : t('crawl.ui.httpStatus', { status: page.amp_target_http_status })
    : t('crawlDeepUi.notCheckedThisRun');

  const canonicalAlignment = !page.amp_url
    ? t('crawlDeepUi.noDirectives')
    : page.amp_target_canonical_alignment === 'canonical-to-source'
    ? t('crawlDeepUi.yes')
    : page.amp_target_canonical_alignment === 'missing-canonical'
    ? t('crawlDeepUi.noDirectives')
    : page.amp_target_canonical_alignment
    ? t('crawlDeepUi.no')
    : t('crawlDeepUi.canonicalOutsideRun');

  return (
    <tr className="border-t border-slate-800/80 text-slate-300">
      <td className={`${cell} max-w-56 truncate font-mono`} title={page.url}>
        {page.url}
      </td>
      <td className={cell}>{page.document_language || '—'}</td>
      <td className={`${cell} max-w-72`}>
        <CrawlHreflangList hreflangs={page.hreflangs} t={t} />
      </td>
      <td className={`${cell} max-w-52 break-all font-mono`} title={page.amp_url ?? undefined}>
        {page.amp_url || '—'}
      </td>
      <td className={`${cell} font-mono`}>{ampStatus}</td>
      <td className={cell}>{canonicalAlignment}</td>
    </tr>
  );
};
