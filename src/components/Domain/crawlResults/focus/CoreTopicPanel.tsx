import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CoreTopic } from '@/services/siteFocus';
import { can } from '@/services/team/roles';
import { readIdentity } from '@/services/team/identity';
import { deniedMessage, enforcePermission } from '@/services/team/enforce';
import { formatPct } from './focusText';

const TOP_TERMS = 5;

export interface CoreTopicPanelProps {
  coreTopic: CoreTopic;
  /** Share of site content closely related to the core topic, 0-100. */
  coveragePct: number;
  confidence: number;
  manualTopic: string;
  onManualTopicChange: (value: string) => void;
}

export const CoreTopicPanel = ({ coreTopic, coveragePct, confidence, manualTopic, onManualTopicChange }: CoreTopicPanelProps) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const allowed = can(readIdentity().role, 'modify_site_focus_rules');
  const open = editing || manualTopic !== '';
  const begin = () => { if (enforcePermission('modify_site_focus_rules')) setEditing(true); };
  const reset = () => { if (!enforcePermission('modify_site_focus_rules')) return; onManualTopicChange(''); setEditing(false); };
  const top = coreTopic.terms.slice(0, TOP_TERMS);
  const max = Math.max(1, ...top.map((term) => term.coveragePct));

  return (
    <section aria-labelledby="focus-core-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="focus-core-title" className="text-sm font-semibold text-slate-200">{t('focus.core.title')}</h2>
      <p className="text-xs text-slate-400">{t('focus.core.label')}</p>
      <p className="text-lg font-semibold text-emerald-300" data-testid="focus-core-label">{coreTopic.label}</p>
      <ul aria-label={t('focus.core.terms')} className="space-y-1.5">
        {top.map((term) => (
          <li key={term.term} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-xs text-slate-300">
            <span className="truncate">{term.term}</span>
            <span
              role="img"
              aria-label={t('focus.core.termAria', { term: term.term, pct: formatPct(term.coveragePct) })}
              className="h-2 overflow-hidden rounded bg-slate-800"
            >
              <span className="block h-2 rounded bg-emerald-500" style={{ width: `${Math.min(100, (term.coveragePct / max) * 100)}%` }} />
            </span>
            <span className="text-end tabular-nums">{formatPct(term.coveragePct)}%</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-300">{t('focus.core.coverage', { pct: formatPct(coveragePct) })}</p>
      <p className="text-xs text-slate-400">{t('focus.core.confidenceLine', { pct: formatPct(confidence) })}</p>
      {coreTopic.manualOverride && <p className="text-xs text-amber-200">{t('focus.core.manualActive', { input: coreTopic.manualOverride.input })}</p>}
      {open ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-slate-300">
            {t('focus.core.inputLabel')}
            <input
              type="text"
              value={manualTopic}
              placeholder={t('focus.core.placeholder')}
              readOnly={!allowed}
              onChange={(event) => onManualTopicChange(event.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            />
          </label>
          <button
            type="button"
            onClick={reset}
            disabled={!allowed}
            className="rounded border border-slate-600 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            {t('focus.core.reset')}
          </button>
        </div>
      ) : (
        <button type="button" onClick={begin} disabled={!allowed} className="rounded text-xs text-emerald-300 underline hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
          {t('focus.core.wrong')}
        </button>
      )}
      {!allowed && <p role="note" className="text-xs text-amber-200">{deniedMessage()}</p>}
    </section>
  );
};
