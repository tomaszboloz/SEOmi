import React from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { OutreachTarget } from '@/services/outreachCopilot';

export interface OutreachTargetsPanelProps {
  targets: OutreachTarget[];
  /** Called with the CSV text; the caller decides how to save it. */
  onExport: (targets: OutreachTarget[]) => void;
}

export const OutreachTargetsPanel: React.FC<OutreachTargetsPanelProps> = ({ targets, onExport }) => {
  const { t } = useTranslation();
  return (
    <section className="space-y-2 rounded-lg border border-slate-800 p-4 text-sm text-slate-300" data-testid="outreach-panel">
      <h3 className="flex items-center gap-1 font-semibold text-slate-100">
        {t('outreach.title')}
        <HelpTip id="outreach.gapDomains" />
      </h3>
      {targets.length === 0 ? (
        <p>{t('outreach.empty')}</p>
      ) : (
        <>
          <ul className="space-y-1">
            {targets.map((target) => (
              <li key={target.domain}>
                {t('outreach.row', { domain: target.domain, priority: target.priority.toFixed(2), count: target.linkingCompetitors.length })}
              </li>
            ))}
          </ul>
          <button type="button" className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-800" onClick={() => onExport(targets)}>
            {t('outreach.export')}
          </button>
          <p className="text-xs text-slate-400">{t('outreach.manualNote')}</p>
        </>
      )}
    </section>
  );
};
