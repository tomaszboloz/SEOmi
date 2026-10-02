import React from 'react';
import type { CrawledPageSummary } from '@/types';
import type { TFunction } from 'i18next';
import { crawlErrorLabel } from '@/services/crawlErrors';
import { cell } from '../crawlResultsHelpers';
import { CrawlPageDiscoveryCell } from './CrawlPageDiscoveryCell';
import { CrawlPageEvidenceDetails } from './CrawlPageEvidenceDetails';

interface CrawlPageTableRowProps {
  page: CrawledPageSummary;
  evidenceUrl: string | null;
  evidenceHref: (url: string) => string;
  hasRun: boolean;
  t: TFunction;
}

export const CrawlPageTableRow: React.FC<CrawlPageTableRowProps> = ({
  page,
  evidenceUrl,
  evidenceHref,
  hasRun,
  t,
}) => {
  return (
    <tr
      id={`crawl-row-${encodeURIComponent(page.url)}`}
      className={`border-t border-slate-800/80 text-slate-300 ${
        evidenceUrl === page.url
          ? 'bg-emerald-500/10 ring-1 ring-inset ring-emerald-400/40'
          : ''
      }`}
    >
      <td className={cell}>
        <span
          className={
            page.request_error_kind || page.http_status >= 400
              ? 'text-rose-300'
              : 'text-emerald-300'
          }
          title={
            page.request_error_kind
              ? `${crawlErrorLabel(page.request_error_kind)} (${page.request_error_kind})`
              : undefined
          }
        >
          {page.http_status ||
            (page.request_error_kind
              ? crawlErrorLabel(page.request_error_kind)
              : '—')}
        </span>
        {page.request_error_kind && (
          <span className="ml-1 font-mono text-[10px] text-rose-300/70">
            ({page.request_error_kind})
          </span>
        )}
      </td>
      <td
        className={`${cell} max-w-[360px] truncate font-mono`}
        title={page.url}
      >
        {hasRun ? (
          <a
            href={evidenceHref(page.url)}
            className="text-emerald-200 underline decoration-emerald-500/40 underline-offset-2 hover:text-white"
            aria-label={t('crawl.ui.openEvidence', { url: page.url })}
          >
            {page.url}
          </a>
        ) : (
          page.url
        )}
      </td>
      <CrawlPageDiscoveryCell page={page} t={t} />
      <td
        className={`${cell} max-w-56 truncate`}
        title={page.title ?? undefined}
      >
        {page.title || '—'}
      </td>
      <td className={`${cell} text-center font-mono`}>{page.depth}</td>
      <td className={`${cell} text-center font-mono`}>{page.h1_count}</td>
      <td
        className={`${cell} text-right font-mono`}
        title={
          page.sentence_count == null
            ? undefined
            : t('crawlDeepUi.sentenceCount', { count: page.sentence_count })
        }
      >
        {page.word_count}
      </td>
      <td className={`${cell} text-right font-mono`}>
        {page.complexity_score == null ? '—' : `${page.complexity_score}/100`}
        {page.complexity_label ? (
          <span className="ml-1 text-[10px] text-slate-500">
            {page.complexity_label}
          </span>
        ) : null}
      </td>
      <td
        className={`${cell} text-right font-mono`}
        title={
          page.readability_grade == null
            ? undefined
            : `${t('crawl.ui.grade')} ${page.readability_grade.toFixed(1)}${page.readability_method ? ` · ${t('crawl.ui.formula')} ${page.readability_method}` : ''}`
        }
      >
        {page.readability_ease_score == null
          ? '—'
          : `${page.readability_ease_score.toFixed(0)}/100`}
        {page.readability_label ? (
          <span className="ml-1 text-[10px] text-slate-500">
            {page.readability_label}
          </span>
        ) : null}
      </td>
      <td className={`${cell} text-right font-mono`}>
        {page.response_time_ms} {t('performance.milliseconds')}
      </td>
      <td className={`${cell} text-right font-mono`}>{page.issues.length}</td>
      <td className={cell}>
        <CrawlPageEvidenceDetails
          page={page}
          evidenceUrl={evidenceUrl}
          t={t}
        />
      </td>
    </tr>
  );
};
