import type { Ga4Property } from '@/types/ga4';
import type { Ga4T } from './viewTypes';

interface Props { property: Ga4Property | null; truncated: boolean; onLoad: () => void; loading: boolean; t: Ga4T; }

export function Ga4PropertyCard({ property, truncated, onLoad, loading, t }: Props) {
  return <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="font-semibold text-white">{t('ga4.property')}</h2>
        {property ? <p className="font-mono text-xs text-emerald-200 break-all">{property.display_name || property.name}</p> : <p role="note" className="text-xs text-amber-300">{t('ga4.noProperty')}</p>}
      </div>
      {property && <button type="button" disabled={loading} onClick={onLoad} className="rounded-md bg-sky-500/15 px-3 py-2 text-xs text-sky-200 border border-sky-500/30 disabled:opacity-40">{loading ? t('ga4.loading') : t('ga4.loadReport')}</button>}
    </div>
    {property && <p className="text-[11px] text-slate-500 break-all">{property.name} · {property.stream_urls.join(', ')}</p>}
    {truncated && <p role="note" className="text-xs text-amber-300">{t('ga4.truncated')}</p>}
  </section>;
}
