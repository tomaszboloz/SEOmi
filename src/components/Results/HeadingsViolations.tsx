import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

export const HeadingsViolations: React.FC<{ issues: string[] }> = ({ issues }) => {
  const { t } = useTranslation();
  if (!issues.length) return null;
  return (
    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
      <div className="flex items-center space-x-2 text-xs font-semibold text-amber-400">
        <AlertTriangle className="w-4 h-4" />
        <span>{t('legacyUi.headings.violations')}</span>
      </div>
      <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pl-1">
        {issues.map((iss, idx) => (
          <li key={idx}>{iss}</li>
        ))}
      </ul>
    </div>
  );
};
