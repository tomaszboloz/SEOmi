import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import { copyText } from '@/services/clipboard';
import { draftOutreach, type DraftTemplate, type OutreachTarget, type UniqueSource } from '@/services/outreachCopilot';
import type { IgosSourceStatus } from '@/services/outreachCopilot/source';

export interface OutreachDraftPanelProps {
  target: OutreachTarget;
  site: string;
  source: UniqueSource | null;
  sourceStatus: IgosSourceStatus;
  template: DraftTemplate;
}

export const OutreachDraftPanel: React.FC<OutreachDraftPanelProps> = ({ target, site, source, sourceStatus, template }) => {
  const { t } = useTranslation();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'copyFailed'>('idle');
  const draft = draftOutreach(target, site, source, template);
  const copyDraft = async () => setCopyState((await copyText(`${draft!.subject}\n\n${draft!.body}`)) ? 'copied' : 'copyFailed');

  if (!draft || !source) {
    const key = sourceStatus === 'ready' ? 'outreach.sourceMissing'
      : sourceStatus === 'partial' ? 'outreach.sourcePartial' : 'outreach.sourceUnavailable';
    return <p data-testid="outreach-source-status" className="text-xs text-amber-300">{t(key)}</p>;
  }

  return (
    <section className="space-y-2 rounded border border-slate-800 bg-slate-950/40 p-3" data-testid="outreach-draft">
      <h4 className="flex items-center gap-1 font-medium text-slate-100">{t('outreach.draftTitle', { domain: target.domain })}<HelpTip id="outreach.gapDomains" /></h4>
      {sourceStatus === 'partial' && <p role="alert" className="text-xs text-amber-300">{t('outreach.sourcePartial')}</p>}
      <p className="break-words text-xs text-slate-400">{t('outreach.sourceProvenance', { title: source.title, url: source.url })}</p>
      <label className="block text-xs text-slate-400">{t('outreach.subjectLabel')}
        <input readOnly value={draft.subject} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200" />
      </label>
      <label className="block text-xs text-slate-400">{t('outreach.bodyLabel')}
        <textarea readOnly value={draft.body} rows={7} className="mt-1 w-full resize-y rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200" />
      </label>
      <button type="button" onClick={() => void copyDraft()} className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800">{t('outreach.copyDraft')}</button>
      {copyState !== 'idle' && <p role="status" className="text-xs text-slate-400">{t(`outreach.${copyState}`)}</p>}
      <p className="text-xs text-slate-400">{t('outreach.manualNote')}</p>
    </section>
  );
};
