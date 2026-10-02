import { useTranslation } from 'react-i18next';
import type { GscPerformanceSnapshot } from '@/services/gscPerformanceTracker';
import { findCtrOutliers, findNearTopTenQueries } from '@/services/gscTracker/opportunities';

export function GscOpportunities({ snapshot }: { snapshot: GscPerformanceSnapshot }) {
  const { t } = useTranslation();
  const near = findNearTopTenQueries(snapshot);
  const ctr = findCtrOutliers(snapshot);
  return <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
    <h2 className="font-semibold text-white">{t('gscOpportunities.title')}</h2>
    <p className="text-xs text-slate-400">{t('gscOpportunities.method')}</p>
    {snapshot.queries_may_be_truncated && <p role="note" className="text-xs text-amber-300">{t('searchConsole.truncatedWarning')}</p>}
    <div className="grid gap-4 md:grid-cols-2">
      <div><h3 className="text-sm text-emerald-300">{t('gscOpportunities.near')}</h3>
        <ul>{near.slice(0, 20).map(row => <li key={row.query} className="border-t border-slate-800 py-2 text-xs text-slate-200">
          {row.query} · #{row.position.toFixed(1)} · {row.impressions} {t('searchConsole.impressionsShort')}
        </li>)}</ul>
        {!near.length && <p className="text-xs text-slate-500">{t('gscOpportunities.empty')}</p>}
      </div>
      <div><h3 className="text-sm text-amber-300">{t('gscOpportunities.ctr')}</h3>
        <ul>{ctr.slice(0, 20).map(row => <li key={row.query} className="border-t border-slate-800 py-2 text-xs text-slate-200">
          {row.query} · {t('gscOpportunities.benchmark', { actual: row.observedCtr.toFixed(1),
            expected: row.peerCtr.toFixed(1), count: row.peerCount })}
        </li>)}</ul>
        {!ctr.length && <p className="text-xs text-slate-500">{t('gscOpportunities.empty')}</p>}
      </div>
    </div>
    <p className="text-xs text-slate-400">{t('gscOpportunities.aiOverview')}</p>
    <a href="https://developers.google.com/search/docs/appearance/ai-features#performance"
      target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-300">{t('gscOpportunities.source')}</a>
  </section>;
}
