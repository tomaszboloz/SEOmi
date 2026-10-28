import { useTranslation } from 'react-i18next';
import type { CoreTopic } from '@/services/siteFocus';
import { can } from '@/services/team/roles';
import { readIdentity } from '@/services/team/identity';
import { deniedMessage } from '@/services/team/enforce';

export interface CoreAnchorsPanelProps {
  coreTopic: CoreTopic;
  /** Anchor URLs as typed: one per line. */
  value: string;
  onChange: (value: string) => void;
}

/** Home page plus key offer pages that pick the Core Topic, so a large blog cannot redefine the offer (#82). */
export const CoreAnchorsPanel = ({ coreTopic, value, onChange }: CoreAnchorsPanelProps) => {
  const { t } = useTranslation();
  const allowed = can(readIdentity().role, 'modify_site_focus_rules');
  const mode = coreTopic.mode ?? 'auto';
  const anchors = coreTopic.anchors;
  const requested = value.trim() !== '';

  return (
    <section aria-labelledby="focus-anchors-title" className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="focus-anchors-title" className="text-sm font-semibold text-slate-200">{t('focus.anchors.title')}</h2>
      <p className="text-xs text-slate-300" data-testid="focus-core-mode">{t(`focus.anchors.mode.${mode}`)}</p>
      <label className="flex flex-col gap-1 text-xs text-slate-300">
        {t('focus.anchors.inputLabel')}
        <textarea
          value={value}
          rows={3}
          placeholder={t('focus.anchors.placeholder')}
          readOnly={!allowed}
          onChange={(event) => onChange(event.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        />
      </label>
      <p className="text-xs text-slate-400">{t('focus.anchors.help')}</p>
      {anchors?.applied && <p className="text-xs text-emerald-300">{t('focus.anchors.applied', { count: anchors.sources.length })}</p>}
      {requested && mode === 'manual' && <p className="text-xs text-amber-200">{t('focus.anchors.manualWins')}</p>}
      {anchors && anchors.missing.length > 0 && (
        <div className="text-xs text-amber-200">
          <p>{t('focus.anchors.missing', { count: anchors.missing.length })}</p>
          <ul className="list-inside list-disc break-all">
            {anchors.missing.map((url) => <li key={url}>{url}</li>)}
          </ul>
        </div>
      )}
      {!allowed && <p role="note" className="text-xs text-amber-200">{deniedMessage()}</p>}
    </section>
  );
};
