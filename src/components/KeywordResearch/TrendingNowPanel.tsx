import React from 'react';
import { RadioTower } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTrendingNowSession } from './useTrendingNowSession';
import { TrendingNowControls } from './TrendingNowControls';
import { TrendingNowSnapshot } from './TrendingNowSnapshot';

export const TrendingNowPanel: React.FC = () => {
  const { t } = useTranslation();
  const session = useTrendingNowSession();

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-md" aria-labelledby="trending-now-title">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-300">
            <RadioTower className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider">{t('trendingNowUi.badge')}</span>
          </div>
          <h2 id="trending-now-title" className="mt-1 text-xl font-bold text-white">{t('trendingNowUi.title')}</h2>
          <p className="text-sm text-slate-400">{t('trendingNowUi.description')}</p>
        </div>
        <span className="text-xs text-slate-500">{t('trendingNowUi.freeSource')}</span>
      </div>

      <TrendingNowControls
        t={t}
        geo={session.geo}
        setGeo={session.setGeo}
        onRefresh={() => void session.refresh()}
        onImport={(file) => void session.importFile(file)}
        onClear={session.clear}
        isLoading={session.isLoading}
        hasSnapshot={Boolean(session.snapshot)}
        hasProject={Boolean(session.activeProjectId)}
        maxPayloadBytes={session.maxPayloadBytes}
      />

      {!session.activeProjectId && <p className="mt-3 text-sm text-amber-200">{t('trendingNowUi.selectProjectError')}</p>}
      {session.error && <p role="alert" className="mt-3 rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-sm text-rose-200">{session.error}</p>}
      <div className="mt-5"><TrendingNowSnapshot snapshot={session.snapshot} t={t} /></div>
    </section>
  );
};
