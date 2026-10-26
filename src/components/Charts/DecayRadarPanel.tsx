import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { DecayEvaluation } from '@/services/semanticDecay/alert';

/** Advisory drift report with cited changes. Empty state when there is no evidence. */
export const DecayRadarPanel = ({ evaluation, snapshotCount = 0 }: { evaluation: DecayEvaluation; snapshotCount?: number }) => {
  const { t } = useTranslation();
  const c = evaluation.comparison;
  return <section className="space-y-2 text-xs text-slate-200" aria-label={t('decayUi.title')}>
    <h4 className="font-semibold">{t('decayUi.title')} <HelpTip id="decay.radar" /></h4>
    <p role="status" className="text-slate-300">{t(`decayUi.verdict.${evaluation.verdict}`)}</p>
    <p className="text-slate-400">{t('decayUi.snapshots', { count: snapshotCount })}</p>
    {c?.status === 'ready' && <ul className="list-disc pl-4">
      <li>{t('decayUi.shift', { value: ((c.centroidShift ?? 0) * 100).toFixed(1) })}</li>
      {c.newEntities.length > 0 && <li>{t('decayUi.newEntities')}: {c.newEntities.join(', ')}</li>}
      {c.lostEntities.length > 0 && <li>{t('decayUi.lostEntities')}: {c.lostEntities.join(', ')}</li>}
      {c.intentChange && <li>{t('decayUi.intent', c.intentChange)}</li>}
      {c.formatChange && <li>{t('decayUi.format', c.formatChange)}</li>}
      {[...c.addedUrls, ...c.removedUrls].slice(0, 10).map((url) => <li key={url} className="break-all">{url}</li>)}
    </ul>}
    {c?.status === 'incompatible' && <p className="text-amber-300">{t('decayUi.incompatible', { fields: c.incompatible.join(', ') })}</p>}
  </section>;
};
