import React, { useEffect, useMemo, useState } from 'react';
import { BookmarkPlus, Loader2, Search, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { buildSuggestionEvidence, GOOGLE_SUGGESTIONS_TAG, importSuggestions, type ImportedSuggestionsResult, type SuggestionsImportFormat } from '@/services/freeSuggestions';
import { useFreeSuggestionsSession } from './useFreeSuggestionsSession';
import { SuggestionEvidenceSummary } from './SuggestionEvidenceSummary';

interface Props { query: string; geo: string; language: string }
const text = (t: (key: string, options?: Record<string, unknown>) => string, key: string, fallback: string, extra: Record<string, unknown> = {}) => t(key, { defaultValue: fallback, ...extra });

export const FreeSuggestionsPanel: React.FC<Props> = ({ query, geo, language }) => {
  const { t } = useTranslation();
  const projectId = useProjectStore((state) => state.activeProjectId);
  const savedKeywords = useToolsStore((state) => state.savedKeywords);
  const crawlRuns = useToolsStore((state) => state.crawlRuns);
  const addSavedKeyword = useToolsStore((state) => state.addSavedKeyword);
  const [importFormat, setImportFormat] = useState<SuggestionsImportFormat>('json');
  const [importPayload, setImportPayload] = useState('');
  const [importSourceUrl, setImportSourceUrl] = useState('');
  const [importState, setImportState] = useState<{ owner: string; result: ImportedSuggestionsResult } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const session = useFreeSuggestionsSession({
    projectId, query, geo, language, savedKeywords,
    onSave: (keyword, provenance) => addSavedKeyword({
      keyword, search_volume: null, difficulty: null, cpc: null, intent: 'Unknown', tags: [GOOGLE_SUGGESTIONS_TAG],
      ...(provenance ? { provenance } : {}),
    }),
  });
  const importOwner = JSON.stringify([projectId, session.inputQuery, geo, language]);
  const imported = importState?.owner === importOwner ? importState.result : null;
  const fetchedEvidence = useMemo(() => session.result ? buildSuggestionEvidence({ suggestions: session.result.suggestions, activeProjectId: projectId, runs: crawlRuns, language }) : null, [crawlRuns, language, projectId, session.result]);
  const importedEvidence = useMemo(() => imported ? buildSuggestionEvidence({ suggestions: imported.suggestions, activeProjectId: projectId, runs: crawlRuns, language }) : null, [crawlRuns, imported, language, projectId]);
  useEffect(() => {
    setImportState(null); setImportError(null); setImportPayload(''); setImportSourceUrl('');
  }, [importOwner]);
  const bytes = new TextEncoder().encode(session.inputQuery).byteLength;
  const tooLong = bytes > 500;
  const label = (key: string, fallback: string, extra?: Record<string, unknown>) => text(t, key, fallback, extra);
  const saveImported = (keyword: string) => {
    if (!projectId || !imported || savedKeywords.some((item) => item.keyword.trim().toLowerCase() === keyword.trim().toLowerCase())) return;
    addSavedKeyword({ keyword, search_volume: null, difficulty: null, cpc: null, intent: 'Unknown', tags: ['User import'], provenance: imported.source });
  };
  const handleImport = () => {
    if (!projectId || !importPayload.trim()) return;
    try {
      setImportState({ owner: importOwner, result: importSuggestions({ format: importFormat, payload: importPayload, query: session.inputQuery, geo, language, sourceUrl: importSourceUrl }) });
      setImportError(null);
    } catch (error) { setImportState(null); setImportError(error instanceof Error ? error.message : 'Suggestions import failed'); }
  };
  return <section className="space-y-4 rounded-xl border border-sky-900/70 bg-slate-900/70 p-5" aria-labelledby="google-suggestions-title">
    <div className="flex items-start gap-3">
      <Search className="mt-1 h-5 w-5 text-sky-300" aria-hidden="true" />
      <div><h2 id="google-suggestions-title" className="text-lg font-semibold text-white">{label('googleSuggestionsUi.title', 'Google suggestions')}</h2>
        <p className="text-sm text-slate-400">{label('googleSuggestionsUi.description', 'Discover related queries from the free Google Suggest endpoint.')}</p></div>
    </div>
    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <label className="grid gap-1 text-xs text-slate-300" htmlFor="google-suggestions-query">{label('googleSuggestionsUi.query', 'Query')}
        <input id="google-suggestions-query" value={session.inputQuery} onChange={(event) => session.setInputQuery(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" />
        <span className={`text-[11px] ${tooLong ? 'text-rose-300' : 'text-slate-500'}`}>{label('googleSuggestionsUi.byteCount', '{{count}}/500 bytes UTF-8', { count: bytes })}</span>
      </label>
      <button type="button" onClick={() => void session.fetchSuggestions()} disabled={!projectId || !session.inputQuery.trim() || tooLong || session.fetching} className="self-end rounded-lg bg-sky-700 px-4 py-2 text-sm text-white disabled:opacity-50">
        {session.fetching ? <Loader2 className="inline h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="inline h-4 w-4" aria-hidden="true" />} {label('googleSuggestionsUi.fetch', 'Fetch suggestions')}
      </button>
    </div>
    {!projectId && <p className="text-sm text-amber-200">{label('googleSuggestionsUi.selectProject', 'Select a project before fetching suggestions.')}</p>}
    {session.error && <p role="alert" className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-sm text-rose-200">{label(session.error.status === 'blocked' ? 'googleSuggestionsUi.blocked' : 'googleSuggestionsUi.error', session.error.status === 'blocked' ? 'Google Suggest is temporarily unavailable.' : 'Google suggestions could not be loaded.')}: {session.error.message}</p>}
    {session.result && <div className="space-y-3" aria-live="polite">
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400"><p><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />{label('googleSuggestionsUi.provenance', 'Source: Google Suggest (unofficial, best effort).')}</p>
        <p>{label('googleSuggestionsUi.context', 'Requested context: {{geo}} / {{language}}. This does not prove result localization.', { geo: session.result.source.requestedGeo, language: session.result.source.requestedLanguage })}</p>
        <p>{label('googleSuggestionsUi.retrievedAt', 'Retrieved at: {{timestamp}}.', { timestamp: session.result.fetchedAt })}</p>
        <a href={session.result.sourceUrl} target="_blank" rel="noreferrer" className="break-all text-sky-300 hover:text-sky-200">{session.result.sourceUrl}</a></div>
      {session.result.suggestions.length === 0 && <p className="text-sm text-slate-400">{label('googleSuggestionsUi.empty', 'No suggestions returned.')}</p>}
      <ul className="grid gap-2 sm:grid-cols-2">{session.result.suggestions.map((suggestion) => <li key={suggestion} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-200"><span>{suggestion}</span><button type="button" onClick={() => session.saveSuggestion(suggestion)} disabled={session.isSaved(suggestion)} className="shrink-0 rounded border border-sky-700/70 px-2 py-1 text-xs text-sky-200 disabled:opacity-50"><BookmarkPlus className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{session.isSaved(suggestion) ? label('googleSuggestionsUi.saved', 'Saved') : label('googleSuggestionsUi.save', 'Save')}</button></li>)}</ul>
      {fetchedEvidence && <SuggestionEvidenceSummary report={fetchedEvidence} />}
    </div>}
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/35 p-3">
      <div><h3 className="text-sm font-semibold text-slate-200">{label('googleSuggestionsUi.importTitle', 'Import suggestions')}</h3><p className="text-xs text-slate-500">{label('googleSuggestionsUi.importDescription', 'Import a local JSON or CSV list. Metrics and intent remain unknown.')}</p></div>
      <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
        <select aria-label={label('googleSuggestionsUi.importFormat', 'Import format')} value={importFormat} onChange={(event) => setImportFormat(event.target.value as SuggestionsImportFormat)} className="rounded bg-slate-950 p-2 text-xs text-slate-200"><option value="json">{t("googleSuggestionsUi.json")}</option><option value="csv">{t("googleSuggestionsUi.csv")}</option></select>
        <input aria-label={label('googleSuggestionsUi.importSourceUrl', 'Source URL (optional)')} value={importSourceUrl} onChange={(event) => setImportSourceUrl(event.target.value)} placeholder={t("googleSuggestionsUi.sourcePlaceholder")} className="rounded bg-slate-950 p-2 text-xs text-slate-200" />
      </div>
      <textarea aria-label={label('googleSuggestionsUi.importPayload', 'Suggestions payload')} value={importPayload} onChange={(event) => setImportPayload(event.target.value)} className="min-h-20 w-full rounded bg-slate-950 p-2 font-mono text-xs text-slate-200" />
      <button type="button" disabled={!projectId || !importPayload.trim()} onClick={handleImport} className="rounded bg-emerald-700 px-3 py-2 text-xs text-white disabled:opacity-50">{label('googleSuggestionsUi.import', 'Import')}</button>
      {importError && <p role="alert" className="text-xs text-rose-300">{importError}</p>}
      {imported && <div aria-live="polite" className="space-y-2"><p className="text-xs text-slate-400">{label('googleSuggestionsUi.importedAt', 'Imported at: {{timestamp}} · {{count}} suggestions.', { timestamp: imported.importedAt, count: imported.suggestions.length })}</p><ul className="grid gap-2 sm:grid-cols-2">{imported.suggestions.map((suggestion) => <li key={suggestion} className="flex items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1 text-xs text-slate-300"><span>{suggestion}</span><button type="button" onClick={() => saveImported(suggestion)} disabled={!projectId || savedKeywords.some((item) => item.keyword.trim().toLowerCase() === suggestion.toLowerCase())} className="rounded border border-sky-700/70 px-2 py-1 text-[11px] text-sky-200 disabled:opacity-50">{label('googleSuggestionsUi.save', 'Save')}</button></li>)}</ul>{importedEvidence && <SuggestionEvidenceSummary report={importedEvidence} />}</div>}
    </div>
  </section>;
};
