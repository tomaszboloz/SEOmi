import React, { useRef } from 'react';
import { FileUp, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import type { TFunction } from 'i18next';

const COUNTRIES = ['PL', 'US', 'GB', 'DE', 'FR', 'ES', 'IT', 'CA', 'AU', 'JP', 'BR', 'IN'];

interface TrendingNowControlsProps {
  t: TFunction;
  geo: string;
  setGeo: (geo: string) => void;
  onRefresh: () => void;
  onImport: (file: File) => void;
  onClear: () => void;
  isLoading: boolean;
  hasSnapshot: boolean;
  hasProject: boolean;
  maxPayloadBytes: number;
}

export const TrendingNowControls: React.FC<TrendingNowControlsProps> = ({
  t, geo, setGeo, onRefresh, onImport, onClear, isLoading, hasSnapshot, hasProject, maxPayloadBytes,
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const chooseFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onImport(file);
  };
  const sizeLabel = `${Math.round(maxPayloadBytes / 1024 / 1024)} MiB`;

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(10rem,14rem)_auto_auto_auto] md:items-end">
      <label className="space-y-1 text-xs text-slate-400">
        <span>{t('trendingNowUi.countryLabel')}</span>
        <select
          aria-label={t('trendingNowUi.countryLabel')}
          value={geo}
          disabled={isLoading || !hasProject}
          onChange={(event) => setGeo(event.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        >
          {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
        </select>
      </label>

      <button type="button" onClick={onRefresh} disabled={isLoading || !hasProject} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
        {t('trendingNowUi.refresh')}
      </button>

      <div className="space-y-1">
        <input ref={fileInput} type="file" accept=".csv,text/csv,.json,application/json" onChange={chooseFile} disabled={isLoading || !hasProject} aria-label={t('trendingNowUi.importFile')} className="sr-only" />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={isLoading || !hasProject} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50">
          <FileUp className="h-4 w-4" aria-hidden="true" />
          {t('trendingNowUi.importFile')}
        </button>
        <p className="text-[11px] text-slate-500">{t('trendingNowUi.importLimit', { size: sizeLabel })}</p>
      </div>

      <button type="button" onClick={onClear} disabled={isLoading || !hasSnapshot || !hasProject} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50">
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {t('trendingNowUi.clear')}
      </button>
    </div>
  );
};
