import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import { draftOutreach, type DraftTemplate, type InformationGainSource, type OutreachTarget } from '@/services/outreachCopilot';

export interface OutreachTargetsPanelProps {
  targets: OutreachTarget[];
  /** Called with the CSV text; the caller decides how to save it. */
  onExport: (targets: OutreachTarget[]) => void;
  site?: string;
  source?: InformationGainSource | null;
}

export const OutreachTargetsPanel: React.FC<OutreachTargetsPanelProps> = ({ targets, onExport, site = '', source = null }) => {
  const { t } = useTranslation();
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const template: DraftTemplate = { subject: t('outreach.draftSubject'), body: t('outreach.draftBody') };
  const disclosedSource = source ? { ...source, provenance: { ...source.provenance, approximation: source.provenance.approximation === 'local-lexical' ? t('outreach.localApproximation') : source.provenance.approximation, observedAt: source.provenance.observedAt ?? t('outreach.unknown') } } : null;
  const selected = selectedDomain ? targets.find((target) => target.domain === selectedDomain) : null;
  const draft = selected && disclosedSource && site ? draftOutreach(selected, site, disclosedSource, template) : null;
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
                {source && site && <button type="button" className="ml-2 rounded border border-slate-700 px-2 py-0.5 text-xs hover:bg-slate-800" onClick={() => setSelectedDomain(target.domain)}>{t('outreach.draft')}</button>}
              </li>
            ))}
          </ul>
          <button type="button" className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-800" onClick={() => onExport(targets)}>
            {t('outreach.export')}
          </button>
          {disclosedSource && <p data-testid="outreach-evidence" className="text-xs text-slate-400">{t('outreach.evidence', { score: disclosedSource.score, url: disclosedSource.evidenceUrl })}</p>}
          {disclosedSource && <p data-testid="outreach-provenance" className="text-xs text-slate-400">{t('outreach.provenance', { provider: disclosedSource.provenance.provider, model: disclosedSource.provenance.model, approximation: disclosedSource.provenance.approximation, observedAt: disclosedSource.provenance.observedAt })}</p>}
          {draft && <aside data-testid="outreach-draft" className="space-y-1 rounded border border-emerald-900/60 bg-emerald-950/20 p-3">
            <p className="font-medium text-slate-100">{draft.subject}</p>
            <textarea aria-label={t('outreach.draft')} readOnly value={draft.body} rows={5} className="w-full rounded bg-slate-950 p-2 text-xs" />
            <p className="text-xs text-slate-400">{t('outreach.manualNote')}</p>
          </aside>}
          <p className="text-xs text-slate-400">{t('outreach.manualNote')}</p>
        </>
      )}
    </section>
  );
};
