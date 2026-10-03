import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { AiCitationEvidence } from '@/services/aiCitationEvidence';
import type { CrawlRunRecord } from '@/types';
import type { CitationSummary } from './searchPromptsTypes';
import { AiCitationEvidenceItem } from './AiCitationEvidenceItem';

interface AiCitationEvidenceListProps {
  provider: string;
  citations: string[];
  summary: CitationSummary | undefined;
  evidenceList: AiCitationEvidence[];
  sourceContextRun: CrawlRunRecord | null;
  t: TFunction;
}

export const AiCitationEvidenceList: React.FC<AiCitationEvidenceListProps> = ({
  provider,
  citations,
  summary,
  evidenceList,
  sourceContextRun,
  t,
}) => {
  return (
    <div className="pt-2 border-t border-slate-800/80">
      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
        {t('aiVisibility.search.citationsLabel')}
      </div>

      {summary && (
        <p
          aria-label={t('aiVisibility.search.citationSummaryAria', { provider })}
          className="mb-2 rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5 text-[10px] leading-4 text-slate-400"
        >
          {t('aiVisibility.search.citations')} <span className="font-mono text-slate-200">{summary.total}</span>
          {' · '}{t('aiVisibility.search.inSnapshot')} <span className="font-mono text-emerald-300">{summary.matched}</span>
          {' · '}{t('aiVisibility.search.contextSignal')} <span className="font-mono text-sky-300">{summary.contextual}</span>
          {' · '}{t('aiVisibility.search.sentenceMatch')} <span className="font-mono text-violet-300">{summary.sentenceMatches}</span>
        </p>
      )}

      <div className="space-y-1">
        {citations.map((cite, cIdx) => (
          <div key={cIdx} className="text-[11px] font-mono text-emerald-400 truncate flex items-center gap-1">
            <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
            <a href={cite} target="_blank" rel="noreferrer">
              {cite}
            </a>
          </div>
        ))}
        {!citations.length && (
          <p className="text-[10px] text-slate-600">{t('aiVisibility.search.noUrls')}</p>
        )}
      </div>

      {citations.length > 0 && (
        <ul
          aria-label={t('aiVisibility.search.citationContextAria', { provider })}
          className="mt-2 space-y-1.5"
        >
          {citations.map((cite, cIdx) => (
            <AiCitationEvidenceItem
              key={`${cite}-${cIdx}`}
              cite={cite}
              cIdx={cIdx}
              evidence={evidenceList[cIdx]}
              sourceContextRun={sourceContextRun}
              t={t}
            />
          ))}
        </ul>
      )}
    </div>
  );
};
