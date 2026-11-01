import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invokeTauriCommand } from '@/services/tauri/transport';
import { fetchGa4Outcomes } from '@/services/experiments/ga4Outcome';
import { saveGa4Outcomes, type Ga4Outcomes } from '@/services/experiments/ga4OutcomeStore';
import type { Intervention } from '@/services/experiments/registry';

/** Loads and saves the daily GA4 outcomes of the intervention target (#97) through the desktop command. */
export const Ga4OutcomeLoader = ({ projectId, intervention, clientId, siteUrl, saved, onLoaded, now = () => new Date() }: {
  projectId: string; intervention: Intervention; clientId: string; siteUrl: string; saved?: Ga4Outcomes; onLoaded: () => void; now?: () => Date;
}) => {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const load = async () => {
    try {
      const series = await fetchGa4Outcomes({ projectId, clientId, siteUrl, target: intervention.url, interventionDate: intervention.date }, now(), invokeTauriCommand);
      const stored = series !== null && saveGa4Outcomes(projectId, intervention.url, series);
      setFailed(!stored);
      if (stored) onLoaded();
    } catch { setFailed(true); }
  };
  return <p>
    <button type="button" disabled={!clientId || !siteUrl} onClick={() => void load()} className="rounded border border-slate-600 px-3 py-1">{t('causalImpactUi.ga4Load')}</button>
    {(!clientId || !siteUrl) && <span> {t('causalImpactUi.ga4NeedsConnection')}</span>}
    {saved && <span> {t('causalImpactUi.ga4Loaded', { days: saved.daily.length, currency: saved.currency })}</span>}
    {failed && <span role="alert"> {t('causalImpactUi.ga4LoadFailed')}</span>}
  </p>;
};
