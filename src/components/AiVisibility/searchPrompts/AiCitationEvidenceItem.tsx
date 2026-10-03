import React from 'react';
import type { TFunction } from 'i18next';
import type { AiCitationEvidence } from '@/services/aiCitationEvidence';
import type { CrawlRunRecord } from '@/types';

interface AiCitationEvidenceItemProps {
  cite: string;
  cIdx: number;
  evidence: AiCitationEvidence | undefined;
  sourceContextRun: CrawlRunRecord | null;
  t: TFunction;
}

export const AiCitationEvidenceItem: React.FC<AiCitationEvidenceItemProps> = ({
  cite,
  cIdx,
  evidence,
  sourceContextRun,
  t,
}) => {
  const statusLabel = !sourceContextRun
    ? t('aiVisibility.search.statusNoSnapshot')
    : !evidence?.normalizedUrl
    ? t('aiVisibility.search.statusInvalidUrl')
    : !evidence.matched
    ? t('aiVisibility.search.statusAbsent')
    : t('aiVisibility.search.statusPresent', {
        status: evidence.page?.http_status ?? '—',
        indexability: evidence.page?.indexability_status || t('aiVisibility.search.indexabilityUnknown'),
      });

  const matchDetail = evidence?.matched
    ? evidence.matchKind
      ? t('aiVisibility.search.matchDetail', {
          label: evidence.page?.title || evidence.page?.final_url || evidence.page?.url || '',
          kind: evidence.matchKind,
        })
      : evidence.page?.title || evidence.page?.final_url || evidence.page?.url || ''
    : '';

  const contextDetail = evidence?.context
    ? `${t('aiVisibility.search.lexicalContext', {
        matched: evidence.context.matchedTerms.length,
        total: evidence.context.sourceTermCount,
        detail:
          evidence.context.scope === 'sentence-match'
            ? t('aiVisibility.search.sentenceContext', {
                percent: evidence.context.sentenceOverlapPercent ?? 0,
              })
            : evidence.context.scope === 'excerpt'
            ? t('aiVisibility.search.excerptContext')
            : evidence.context.scope === 'semantic-terms'
            ? t('aiVisibility.search.semanticContext')
            : evidence.context.scope === 'title'
            ? t('aiVisibility.search.titleContext')
            : t('aiVisibility.search.noSignalContext'),
      })}${
        evidence.context.meetsMinimum
          ? ` · ${t('aiVisibility.search.observableSignal')}`
          : ` · ${t('aiVisibility.search.belowThreshold')}`
      }`
    : '';

  const spanDetail = evidence?.context
    ? [
        evidence.context.responseSpan
          ? t('aiVisibility.search.responseRange', {
              start: evidence.context.responseSpan.start,
              end: evidence.context.responseSpan.end,
            })
          : '',
        evidence.context.sourceSpan
          ? t(
              evidence.context.sourceSpan.source === 'title'
                ? 'aiVisibility.search.sourceRangeTitle'
                : 'aiVisibility.search.sourceRangeExcerpt',
              {
                start: evidence.context.sourceSpan.start,
                end: evidence.context.sourceSpan.end,
              },
            )
          : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <li
      key={`${cite}-${cIdx}`}
      className={`rounded border px-2 py-1.5 text-[9px] ${
        evidence?.matched
          ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200'
          : 'border-slate-800 text-slate-500'
      }`}
    >
      <span className="block break-all">{statusLabel}</span>
      {matchDetail && <span className="mt-0.5 block break-words text-slate-500">{matchDetail}</span>}
      {contextDetail && (
        <span className="mt-0.5 block break-words text-slate-500">
          {contextDetail}
          {evidence?.context?.matchedTerms.length ? ` · ${evidence.context.matchedTerms.join(', ')}` : ''}
        </span>
      )}
      {spanDetail && (
        <span className="mt-0.5 block break-words text-slate-500">
          {t('aiVisibility.search.evidenceRange', { range: spanDetail })}
        </span>
      )}
      {evidence?.context?.matchedTermEvidence?.length ? (
        <span className="mt-0.5 block break-words text-slate-500">
          {t('aiVisibility.search.termPositions', {
            terms: evidence.context.matchedTermEvidence
              .map((term) => `${term.term}${term.response ? ` @${term.response.start}–${term.response.end}` : ''}`)
              .join(', '),
          })}
        </span>
      ) : null}
      {evidence?.context?.matchedResponseSentence && (
        <span className="mt-0.5 block break-words text-slate-600">
          {t('aiVisibility.search.responseSentence', { text: evidence.context.matchedResponseSentence })}
        </span>
      )}
      {evidence?.context?.matchedExcerpt && (
        <span className="mt-0.5 block break-words text-slate-600">
          {t('aiVisibility.search.localExcerpt', { text: evidence.context.matchedExcerpt })}
        </span>
      )}
    </li>
  );
};
