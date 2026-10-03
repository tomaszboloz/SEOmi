import React from 'react';
import type { TFunction } from 'i18next';
import { Info } from 'lucide-react';
import type { AmpFinding } from '@/types';
import { AmpFindingItem } from './AmpFindingItem';

interface AmpFindingsCardProps {
  findings: AmpFinding[];
  t: TFunction;
}

export const AmpFindingsCard: React.FC<AmpFindingsCardProps> = ({ findings, t }) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="mb-3 text-xs font-semibold text-slate-200">
        {t('ampUi.findings', { count: findings.length })}
      </h3>
      {findings.length === 0 ? (
        <div className="flex items-start gap-2 text-xs leading-5 text-slate-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('ampUi.noFindings')}
        </div>
      ) : (
        <ul className="space-y-3">
          {findings.map((finding) => (
            <AmpFindingItem key={finding.code} finding={finding} t={t} />
          ))}
        </ul>
      )}
    </div>
  );
};
