import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_SERP_IMPORT_BYTES, type SerpImportFormat } from '@/services/serpImport';
import type { ImportedSerp } from './importedSerpStorage';
import { useFreeSerpSession } from './useFreeSerpSession';

interface Props {
  projectId: string | null;
  imported: ImportedSerp | null;
  error: string | null;
  onImport: (payload: string, format: SerpImportFormat) => void;
  onClear: () => void;
}

export const SerpImportPanel = ({ projectId, imported, error, onImport, onClear }: Props) => {
  const { t } = useTranslation();
  const [payload, setPayload] = useState('');
  const [format, setFormat] = useState<SerpImportFormat>('json');
  const [keyword, setKeyword] = useState('');
  const [country, setCountry] = useState('PL');
  const [language, setLanguage] = useState('pl');
  const feed = useFreeSerpSession({ projectId, keyword, country, language, importedAt: imported?.importedAt ?? null, onImport: payload => onImport(payload, 'json') });
  const feedMessage = feed.error && `${feed.error.status === 'blocked' ? t('serpImportUi.feedBlocked') : t('serpImportUi.feedError')}: ${feed.error.message}`;
  return <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-5">
    <h2 className="text-sm font-semibold text-white">{t('serpImportUi.title')}</h2>
    <p className="text-xs text-slate-400">{t('serpImportUi.description')}</p>
    <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-950/60 p-3">
      <h3 className="text-xs font-semibold text-slate-200">{t('serpImportUi.fetchTitle')}</h3>
      <p className="text-xs text-slate-500">{t('serpImportUi.fetchHelp')}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="grid gap-1 text-xs text-slate-300 sm:col-span-3" htmlFor="free-serp-keyword">{t('serpImportUi.query')}
          <input id="free-serp-keyword" value={keyword} maxLength={500} onChange={event => setKeyword(event.target.value)} className="rounded bg-slate-900 p-2" />
        </label>
        <label className="grid gap-1 text-xs text-slate-300" htmlFor="free-serp-country">{t('serpImportUi.country')}
          <input id="free-serp-country" value={country} maxLength={2} onChange={event => setCountry(event.target.value)} className="rounded bg-slate-900 p-2 uppercase" />
        </label>
        <label className="grid gap-1 text-xs text-slate-300" htmlFor="free-serp-language">{t('serpImportUi.language')}
          <input id="free-serp-language" value={language} maxLength={17} onChange={event => setLanguage(event.target.value)} className="rounded bg-slate-900 p-2" />
        </label>
        <button type="button" onClick={() => void feed.fetchBing()} disabled={!projectId || !keyword.trim() || feed.fetching}
          className="self-end rounded bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-50">{feed.fetching ? t('serpImportUi.fetching') : t('serpImportUi.fetch')}</button>
      </div>
      {feedMessage && <p role="alert" className="text-xs text-rose-300">{feedMessage}</p>}
    </div>
    <p className="text-xs text-slate-400">{t('serpImportUi.formatHelp')}</p>
    <label className="grid gap-1 text-xs text-slate-300">{t('serpImportUi.format')}
      <select value={format} onChange={event => setFormat(event.target.value as SerpImportFormat)} className="rounded bg-slate-950 p-2">
        <option value="json">{t('overview.exportJson')}</option><option value="csv">{t('overview.exportCsv')}</option>
      </select>
    </label>
    <label className="grid gap-1 text-xs text-slate-300">{t('serpImportUi.payload')}
      <textarea value={payload} onChange={event => setPayload(event.target.value)} maxLength={MAX_SERP_IMPORT_BYTES}
        className="min-h-28 rounded bg-slate-950 p-2 font-mono" />
    </label>
    <div className="flex gap-3">
      <button type="button" disabled={!projectId || !payload.trim()} onClick={() => { feed.cancel(); onImport(payload, format); }}
        className="rounded bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50">{t('serpImportUi.import')}</button>
      <button type="button" disabled={!projectId || !imported} onClick={() => { feed.cancel(); onClear(); }}
        className="rounded bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50">{t('serpImportUi.clear')}</button>
    </div>
    {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
    {imported && <div className="space-y-1 text-xs text-slate-400" aria-live="polite">
      <p>{t('serpImportUi.summary', { count: imported.result.snapshots.length, rejected: imported.result.rejected.length })}</p>
      <p>{t('serpImportUi.source', { provider: imported.result.source.provider ?? t('serpImportUi.unknown'), status: imported.result.source.availability })}</p>
      <p>{t('serpImportUi.context', { country: imported.result.source.countryCode ?? t('serpImportUi.unknown'), language: imported.result.source.languageCode ?? t('serpImportUi.unknown') })}</p>
      <p>{t('serpImportUi.times', { captured: imported.result.source.capturedAt ?? t('serpImportUi.unknown'), imported: imported.importedAt })}</p>
      <p>{t('serpImportUi.retrieved', { retrieved: imported.result.source.retrievedAt ?? t('serpImportUi.unknown') })}</p>
      {imported.result.source.kind === 'bing-rss' && <p role="status" className="text-amber-300">{t('serpImportUi.partialNotice')}</p>}
    </div>}
  </section>;
};
