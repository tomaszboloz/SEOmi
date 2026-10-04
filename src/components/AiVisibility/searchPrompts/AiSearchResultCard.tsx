import React from 'react';
import { Bot, Check, Copy } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { AiPromptComparisonResult, CrawlRunRecord } from '@/types';
import type { AiCitationEvidence } from '@/services/aiCitationEvidence';
import type { CitationSummary } from './searchPromptsTypes';
import { AiCitationEvidenceList } from './AiCitationEvidenceList';
import { appLocale } from '@/services/localeFormat';

interface AiSearchResultCardProps {
  result: AiPromptComparisonResult;
  idx: number;
  copiedIdx: number | null;
  onCopy: (text: string, idx: number) => void;
  summary: CitationSummary | undefined;
  evidenceList: AiCitationEvidence[];
  sourceContextRun: CrawlRunRecord | null;
  t: TFunction;
}

export const AiSearchResultCard: React.FC<AiSearchResultCardProps> = ({
  result,
  idx,
  copiedIdx,
  onCopy,
  summary,
  evidenceList,
  sourceContextRun,
  t,
}) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between space-y-4 shadow-md">
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="font-bold text-white text-sm flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-400" />
            <span>{result.model_name}</span>
          </div>

          <button
            type="button"
            onClick={() => onCopy(result.response_text, idx)}
            className="text-slate-400 hover:text-white p-1 rounded transition"
            title={t('aiVisibility.search.copyResponse')}
          >
            {copiedIdx === idx ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {result.search_mode && (
          <p className="text-xs text-slate-400">
            {t(`aiResearch.${result.search_mode}`)} ·{' '}
            {t('aiResearch.position', { value: result.mention_position ?? '—' })} ·{' '}
            {t(result.own_domain_cited ? 'aiResearch.ownDomainYes' : 'aiResearch.ownDomainNo')}
          </p>
        )}

        {result.brand_mentions.length > 0 && (
          <p className="text-xs text-emerald-300">{result.brand_mentions.join(', ')}</p>
        )}

        <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 leading-relaxed whitespace-pre-line font-sans">
          {result.response_status === 'error' ? (
            <span className="text-rose-200">
              {t('aiVisibility.search.noResponse', { message: result.error_message })}
            </span>
          ) : (
            result.response_text
          )}
        </div>

        <p className="text-[10px] text-slate-600">
          {t('aiVisibility.search.providerMeta', {
            provider: result.provider,
            date: new Date(result.captured_at).toLocaleString(appLocale()),
          })}
        </p>
      </div>

      <AiCitationEvidenceList
        provider={result.provider}
        citations={result.citations}
        summary={summary}
        evidenceList={evidenceList}
        sourceContextRun={sourceContextRun}
        t={t}
      />
    </div>
  );
};
