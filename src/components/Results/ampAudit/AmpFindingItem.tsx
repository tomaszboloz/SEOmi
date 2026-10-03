import React from 'react';
import type { TFunction } from 'i18next';
import { AlertTriangle, Info } from 'lucide-react';
import type { AmpFinding } from '@/types';
import { localizeAmpFinding } from '@/services/ampIssueLocalization';

interface AmpFindingItemProps {
  finding: AmpFinding;
  t: TFunction;
}

export const AmpFindingItem: React.FC<AmpFindingItemProps> = ({ finding, t }) => {
  const localized = localizeAmpFinding(finding, t);
  const isError = finding.severity === 'error';
  const Icon = isError || finding.severity === 'warning' ? AlertTriangle : Info;

  return (
    <li className="flex gap-3 border-t border-slate-800 pt-3 first:border-0 first:pt-0">
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${isError ? 'text-rose-300' : finding.severity === 'warning' ? 'text-amber-300' : 'text-sky-300'}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-100">
          <span>{localized.displayMessage}</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
            {t(`ampUi.severity.${finding.severity}`)}
          </span>
        </div>
        <p className="mt-1 break-words font-mono text-[11px] leading-5 text-slate-400">
          {finding.evidence}
        </p>
        {localized.displayRecommendation && (
          <p className="mt-1 text-xs leading-5 text-slate-300">
            {localized.displayRecommendation}
          </p>
        )}
        <details className="mt-2 text-[10px] text-slate-500">
          <summary className="cursor-pointer text-slate-400">
            {t('ampFindings.sourceEvidence')}
          </summary>
          <p className="mt-1 break-words font-mono">{localized.evidenceMessage}</p>
          {localized.evidenceRecommendation && (
            <p className="mt-1 break-words">{localized.evidenceRecommendation}</p>
          )}
        </details>
      </div>
    </li>
  );
};
