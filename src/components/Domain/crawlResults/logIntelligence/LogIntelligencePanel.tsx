import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CrawlRunRecord } from '@/types';
import { buildLogMatrixView } from './matrixView';
import { LogMatrixTable } from './LogMatrixTable';
import { useLogImport } from './useLogImport';

export default function LogIntelligencePanel({ projectId, run }: { projectId: string; run?: CrawlRunRecord }) {
  const { t: translate, i18n } = useTranslation();
  const inputId = useId();
  const importer = useLogImport(projectId);
  const matrix = useMemo(() => buildLogMatrixView(importer.state, run), [importer.state, run]);
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' });
  const end = importer.state.lastAt;
  const start = end === null ? null : end - Math.max(0, matrix.periodDays - 1) * 86_400_000;
  return <section aria-labelledby={`${inputId}-title`} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-slate-200">
    <h2 id={`${inputId}-title`} className="text-lg font-semibold">{translate('logIntelUi.title')}</h2>
    <p className="text-sm text-slate-400">{translate('logIntelUi.description')}</p>
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor={inputId}>{translate('logIntelUi.chooseFile')}</label>
      <input id={inputId} type="file" accept=".log,.txt" disabled={importer.busy} onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void importer.importFile(file);
      }} />
      {importer.busy && <button type="button" onClick={importer.cancel}>{translate('logIntelUi.cancel')}</button>}
      <button type="button" disabled={importer.busy} onClick={importer.clear}>{translate('logIntelUi.clear')}</button>
    </div>
    {importer.busy && <progress aria-label={translate('logIntelUi.importing')} className="w-full" />}
    <p role="status">{translate('logIntelUi.progress', importer.progress)} {importer.message && translate(`logIntelUi.${importer.message}`)}</p>
    {importer.error && <p role="alert" className="text-amber-300">{translate(`logIntelUi.${importer.error}`)}</p>}
    {importer.state.inProgress && <p>{translate('logIntelUi.resume')}</p>}
    <p className="text-sm text-slate-400">{translate('logIntelUi.verificationNote')}</p>
    <h3 className="font-semibold">{translate('logIntelUi.matrix')}</h3>
    <p>{translate('logIntelUi.coverage', { days: matrix.coverageDays, period: matrix.periodDays })}</p>
    {start !== null && end !== null && <p>{translate('logIntelUi.period', { start: date.format(start), end: date.format(end) })}</p>}
    {!matrix.sufficient && <p className="text-amber-300">{translate('logIntelUi.insufficient')}</p>}
    {!matrix.hasScores && <p className="text-slate-400">{translate('logIntelUi.noScores')}</p>}
    <LogMatrixTable rows={matrix.rows} />
  </section>;
}
