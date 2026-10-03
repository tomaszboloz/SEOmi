import React from 'react';
import type { CrawledPageSummary } from '@/types';
import type { TFunction } from 'i18next';
import { crawlErrorLabel } from '@/services/crawlErrors';
import { discoverySourcesForPage } from '../crawlResultsHelpers';
import { CrawlPageEvidenceIssues } from './CrawlPageEvidenceIssues';

interface CrawlPageEvidenceDetailsProps {
  page: CrawledPageSummary;
  evidenceUrl: string | null;
  t: TFunction;
}

export const CrawlPageEvidenceDetails: React.FC<CrawlPageEvidenceDetailsProps> = ({
  page,
  evidenceUrl,
  t,
}) => {
  const sources = discoverySourcesForPage(page);

  return (
    <details open={evidenceUrl === page.url}>
      <summary className="cursor-pointer text-emerald-200">
        {evidenceUrl === page.url
          ? t('crawl.ui.pageEvidence')
          : t('crawl.ui.showEvidence')}
      </summary>
      <div className="mt-2 min-w-56 space-y-1.5 text-[11px] text-slate-400">
        <p>
          {t('crawl.ui.status')}:{' '}
          <span className="font-mono text-slate-200">
            {page.http_status ||
              (page.request_error_kind
                ? crawlErrorLabel(page.request_error_kind)
                : undefined) ||
              t('crawl.ui.noResponse')}
          </span>{' '}
          · {t('crawl.ui.depth')} {page.depth} · {t('crawl.ui.response')}{' '}
          {page.response_time_ms} {t('performance.milliseconds')}
        </p>
        {page.request_error_kind && (
          <p>
            {t('crawl.ui.transport')}:{' '}
            <span className="text-rose-200">
              {crawlErrorLabel(page.request_error_kind)}
            </span>{' '}
            <span className="font-mono text-slate-400">
              ({page.request_error_kind})
            </span>
          </p>
        )}
        <p>
          {t('crawl.ui.finalUrl')}:{' '}
          <span className="break-all font-mono text-slate-300">
            {page.final_url || page.url}
          </span>
        </p>
        <p>
          {t('crawl.ui.indexability')}:{' '}
          {page.indexability_status || t('crawl.ui.notDetermined')}
          {page.canonical ? ` · canonical: ${page.canonical}` : ''}
        </p>
        {page.indexability_verdict ? (
          <p className="text-slate-400">
            {t('crawl.ui.indexabilityVerdict')}: {page.indexability_verdict.status}
            {page.indexability_verdict.reasons.length
              ? ` · ${page.indexability_verdict.reasons.join(', ')}`
              : ''}
          </p>
        ) : null}
        {(page.sentence_count != null || page.complexity_score != null) && (
          <p>
            {t('crawl.ui.content')} {page.word_count} {t('crawl.ui.words')}
            {page.sentence_count != null
              ? ` · ${page.sentence_count} ${t('crawl.ui.sentences')}`
              : ''}
            {page.average_words_per_sentence != null
              ? ` · ${page.average_words_per_sentence.toFixed(1)} ${t('crawl.ui.wordsPerSentence')}`
              : ''}
            {page.complexity_score != null
              ? ` · ${t('crawl.ui.complexity')} ${page.complexity_score}/100${page.complexity_label ? ` (${page.complexity_label})` : ''}`
              : ''}
            {page.readability_ease_score != null
              ? ` · ${t('crawl.ui.readability')} ${page.readability_ease_score.toFixed(0)}/100${page.readability_grade != null ? ` · ${t('crawl.ui.grade')} ${page.readability_grade.toFixed(1)}` : ''}`
              : ''}
          </p>
        )}
        {page.focus_phrase && (
          <p>
            {t('crawl.ui.focusPhrase', {
              phrase: page.focus_phrase.phrase,
              body: page.focus_phrase.body_occurrences,
              density: page.focus_phrase.body_density_percent.toFixed(1),
              title: page.focus_phrase.title_occurrences,
              meta: page.focus_phrase.meta_description_occurrences,
              h1: page.focus_phrase.h1_occurrences,
            })}
          </p>
        )}
        {sources.length > 0 && (
          <div className="space-y-1 border-t border-slate-800 pt-1.5">
            <p className="font-medium text-sky-200">{t('crawl.ui.urlDiscovery')}</p>
            {sources.map((source, index) => (
              <p
                key={`${source.kind}-${source.source_url || 'none'}-${index}`}
                className="break-all"
              >
                <span className="text-sky-200">
                  {t(`crawl.discovery.${source.kind}`)}
                </span>
                {source.source_url ? ` · ${source.source_url}` : ''}
                {source.anchor_text ? ` · anchor: „${source.anchor_text}”` : ''}
              </p>
            ))}
          </div>
        )}
        <CrawlPageEvidenceIssues issues={page.issues} t={t} />
        {page.redirect_chain.length > 0 && (
          <div className="space-y-1 border-t border-slate-800 pt-1.5">
            {page.redirect_chain.map((hop, index) => (
              <p key={`${hop.from_url}-${index}`} className="break-all">
                <span className="font-mono text-amber-300">
                  {t('exportUi.statuses.http', { status: hop.http_status })}
                </span>{' '}
                · {hop.from_url} → {hop.to_url}
                {hop.response_time_ms == null
                  ? ` · ${t('exportUi.statuses.timingUnavailable')}`
                  : ` · ${hop.response_time_ms} ${t('performance.milliseconds')}`}
              </p>
            ))}
          </div>
        )}
        {page.redirect_stop_reason ? (
          <p className="border-t border-slate-800 pt-1.5 text-amber-200">
            <span className="font-medium">
              {t('crawl.ui.redirectStopReason')}:
            </span>{' '}
            {page.redirect_stop_reason}
          </p>
        ) : null}
      </div>
    </details>
  );
};
