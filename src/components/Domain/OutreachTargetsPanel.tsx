import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import { OutreachDraftPanel } from './OutreachDraftPanel';
import { type DraftTemplate, type IgosSourceStatus, type OutreachTarget, type UniqueSource } from '@/services/outreachCopilot';

export interface OutreachTargetsPanelProps {
  targets: OutreachTarget[];
  /** Called with the CSV text; the caller decides how to save it. */
  onExport: (targets: OutreachTarget[]) => void;
  site?: string;
  source?: UniqueSource | null;
  sources?: UniqueSource[];
  sourceStatus?: IgosSourceStatus;
  draftTemplate?: DraftTemplate;
}

export const OutreachTargetsPanel: React.FC<OutreachTargetsPanelProps> = ({
  targets, onExport, site = '', source = null, sources = [], sourceStatus = 'unavailable', draftTemplate,
}) => {
  const { t } = useTranslation();
  const template = draftTemplate ?? { subject: t('outreach.subjectTemplate'), body: t('outreach.bodyTemplate') };
  const [selectedDomain, setSelectedDomain] = useState(targets[0]?.domain ?? '');
  const [selectedSourceUrl, setSelectedSourceUrl] = useState(source?.url ?? sources[0]?.url ?? '');
  const target = targets.find((item) => item.domain === selectedDomain) ?? targets[0] ?? null;
  const sourceOptions = sources.length ? sources : source ? [source] : [];
  const selectedSource = sourceOptions.find((item) => item.url === selectedSourceUrl) ?? sourceOptions[0] ?? null;
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
                <button type="button" aria-pressed={target.domain === selectedDomain} onClick={() => setSelectedDomain(target.domain)} className="w-full rounded px-1 text-left hover:bg-slate-800">
                  {t('outreach.row', { domain: target.domain, priority: target.priority.toFixed(2), count: target.linkingCompetitors.length })}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-800" onClick={() => onExport(targets)}>
            {t('outreach.export')}
          </button>
          <p className="text-xs text-slate-400">{t('outreach.manualNote')}</p>
          {sourceOptions.length > 1 && (
            <label className="block text-xs text-slate-400">{t('outreach.sourceLabel')}
              <select value={selectedSource.url} onChange={(event) => setSelectedSourceUrl(event.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200">
                <option value="">{t('outreach.sourceChoose')}</option>
                {sourceOptions.map((item) => <option key={item.url} value={item.url}>{item.title}</option>)}
              </select>
            </label>
          )}
          {target && <OutreachDraftPanel target={target} site={site} source={selectedSource} sourceStatus={sourceStatus} template={template} />}
        </>
      )}
    </section>
  );
};
