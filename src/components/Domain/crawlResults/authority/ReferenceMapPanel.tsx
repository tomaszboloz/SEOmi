import { useTranslation } from 'react-i18next';
import type { ReferenceState } from '@/hooks/useTopicalAuthority';
import type { ReferenceTaxonomy } from '@/services/topicalAuthority';

export interface ReferenceMapPanelProps {
  taxonomy: ReferenceTaxonomy | null;
  state: ReferenceState;
  onBuild: () => void;
  onCancel: () => void;
  onClear: () => void;
}

/** Builds the market map from real SERP data; shows an honest empty state when no source is connected. */
export const ReferenceMapPanel = ({ taxonomy, state, onBuild, onCancel, onClear }: ReferenceMapPanelProps) => {
  const { t, i18n } = useTranslation();
  const { running, progress, failure, error } = state;
  return (
    <section aria-labelledby="authority-ref-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="authority-ref-title" className="text-sm font-semibold text-slate-100">{t('authority.reference.title')}</h2>
        <div className="flex gap-2">
          {running ? (
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200">{t('authority.reference.cancel')}</button>
          ) : (
            <button type="button" onClick={onBuild} className="rounded-lg border border-emerald-500/40 px-3 py-1 text-xs text-emerald-200">{taxonomy ? t('authority.reference.rebuild') : t('authority.reference.build')}</button>
          )}
          {taxonomy && !running && <button type="button" onClick={onClear} className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-300">{t('authority.reference.clear')}</button>}
        </div>
      </header>
      {taxonomy ? (
        <p className="text-xs text-slate-300">{t('authority.reference.info', { subtopics: taxonomy.subtopics.length, pillars: taxonomy.pillars.length, competitors: taxonomy.competitors.length, source: taxonomy.source || '—', date: new Date(taxonomy.builtAt).toLocaleDateString(i18n.language) })}</p>
      ) : !running && !failure && !error && <p className="text-xs text-slate-400">{t('authority.reference.intro')}</p>}
      {running && <p role="status" className="text-xs text-slate-300">{t(`authority.reference.progress.${progress?.phase ?? 'serp'}`, { done: progress?.done ?? 0, total: progress?.total ?? 0, domain: progress?.phase === 'crawl' ? progress.domain : '' })}</p>}
      {error && <p role="alert" className="text-xs text-red-300">{t('authority.reference.error', { error })}</p>}
      {failure?.status === 'cancelled' && <p className="text-xs text-slate-400">{t('authority.reference.cancelled')}</p>}
      {failure?.status === 'unavailable' && (
        <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100">
          <strong>{t('authority.reference.unavailableTitle')}</strong>
          <p>{t(`authority.reference.unavailable.${failure.reason}`, { error: failure.error ?? '' })}</p>
        </div>
      )}
    </section>
  );
};
