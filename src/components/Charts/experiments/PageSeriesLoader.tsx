import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invokeTauriCommand } from '@/services/tauri/transport';
import { fetchPageSeries, savePageSeries } from '@/services/experiments/pageSeries';
import type { Intervention } from '@/services/experiments/registry';

/** Loads and saves the daily GSC series of one page (#97) through the desktop command; needs a connected property. */
export const PageSeriesLoader = ({ projectId, intervention, clientId, siteUrl, onLoaded, now = () => new Date() }: {
  projectId: string; intervention: Intervention; clientId: string; siteUrl: string; onLoaded: () => void; now?: () => Date;
}) => {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const load = async () => {
    try {
      const series = await fetchPageSeries({ projectId, clientId, siteUrl, pageUrl: intervention.url, interventionDate: intervention.date }, now(), invokeTauriCommand);
      const saved = series !== null && savePageSeries(projectId, intervention.url, series);
      setFailed(!saved);
      if (saved) onLoaded();
    } catch { setFailed(true); }
  };
  return <p>
    <button type="button" disabled={!clientId || !siteUrl} onClick={() => void load()} className="rounded border border-slate-600 px-3 py-1">{t('causalImpactUi.pageLoad')}</button>
    {(!clientId || !siteUrl) && <span> {t('causalImpactUi.pageNeedsGsc')}</span>}
    {failed && <span role="alert"> {t('causalImpactUi.pageLoadFailed')}</span>}
  </p>;
};
