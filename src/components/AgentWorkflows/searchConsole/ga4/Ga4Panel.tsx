import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ga4ConnectionCard } from './ConnectionCard';
import { Ga4PropertyCard } from './PropertyCard';
import { Ga4ReportTable } from './ReportTable';
import { useGa4Session } from './useGa4Session';
import type { Ga4PanelProps } from './types';

export function Ga4Panel({ session, projectRootUrl, crawlResult }: Ga4PanelProps) {
  const { t } = useTranslation();
  const [clientSecret, setClientSecret] = useState('');
  useEffect(() => { setClientSecret(''); }, [session.activeProjectId, session.gscClientId]);
  const state = useGa4Session({ session, projectRootUrl, crawlResult });
  const busy = state.loading !== 'idle';
  const partialReport = !!state.report && (state.report.may_be_truncated || state.report.status === 'partial');
  const showPanel = !!session.activeProjectId && !!projectRootUrl;
  if (!showPanel) return <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">{t('ga4.projectRequired')}</p>;
  return <section className="space-y-4" aria-label={t('ga4.title')}>
    <Ga4ConnectionCard connected={state.analyticsConnected} loading={busy} hasClientId={!!session.gscClientId.trim()} clientSecret={clientSecret} setClientSecret={setClientSecret} onConnect={() => void state.connectAnalytics(clientSecret)} onRefresh={() => void state.refreshProperties()} t={t} />
    {state.error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-200">{state.error}</p>}
    {state.analyticsConnected && <Ga4PropertyCard property={state.selectedProperty} truncated={!!state.discovery?.may_be_truncated} onLoad={() => void state.loadReport()} loading={busy} t={t} />}
    {state.report && state.joined && <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400"><span>{state.report.start_date} — {state.report.end_date}</span><span>{t('ga4.rowCount', { count: state.report.row_count ?? state.report.rows.length })}</span></div>
      {partialReport && <p role="note" className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">{t('ga4.truncated')}</p>}
      {state.joined.warnings.map((warning) => <p key={warning} role="note" className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">{warning.includes('periods') ? t('ga4.periodsDiffer') : warning}</p>)}
      <Ga4ReportTable rows={state.joined.rows} t={t} />
    </section>}
    {state.analyticsConnected && state.report === null && state.loading === 'idle' && state.discovery?.property && <p role="status" className="text-xs text-slate-500">{t('ga4.unavailable')}</p>}
  </section>;
}
