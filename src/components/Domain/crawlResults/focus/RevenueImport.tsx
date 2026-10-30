import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { forgetRevenueImport, parseGa4RevenueCsv, recallRevenueImport, rememberRevenueImport } from '@/services/urlTelemetry';

/**
 * Optional GA4 revenue export for URL protection (#91). The user states the currency and confirms the export
 * is limited to organic sessions; nothing is inferred. `onChange` lets the parent rebuild its telemetry.
 */
export const RevenueImport = ({ projectId, onChange }: { projectId: string; onChange: () => void }) => {
  const { t } = useTranslation();
  const id = useId();
  const [currency, setCurrency] = useState('');
  const [organic, setOrganic] = useState(false);
  const [current, setCurrent] = useState(() => recallRevenueImport(projectId));
  const [error, setError] = useState('');
  const load = async (file: File) => {
    const parsed = parseGa4RevenueCsv(await file.text(), { currency, organicOnly: organic, sourceFile: file.name });
    if (typeof parsed === 'string') { setError(parsed); return; }
    const saved = rememberRevenueImport(projectId, parsed);
    setError(saved ? '' : 'storage-failed');
    if (saved) { setCurrent(parsed); onChange(); }
  };
  const clear = () => { forgetRevenueImport(projectId); setCurrent(null); onChange(); };
  return <details className="rounded border border-white/10 p-2" data-testid="revenue-import">
    <summary className="cursor-pointer font-semibold">{t('revenueImportUi.title')}</summary>
    <p>{t('revenueImportUi.model')}</p>
    {current
      ? <p>{t('revenueImportUi.current', { file: current.sourceFile, rows: current.rows.length, currency: current.currency,
        period: current.period ? `${current.period.start} – ${current.period.end}` : t('revenueImportUi.noPeriod') })}
      {' '}<button type="button" onClick={clear} className="underline">{t('revenueImportUi.clear')}</button></p>
      : <p>{t('revenueImportUi.none')}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={`${id}-currency`}>{t('revenueImportUi.currency')}</label>
      <input id={`${id}-currency`} value={currency} maxLength={3} className="w-16 bg-slate-900 uppercase"
        onChange={(event) => setCurrency(event.currentTarget.value.toUpperCase())} />
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={organic} onChange={(event) => setOrganic(event.currentTarget.checked)} />
        {t('revenueImportUi.organic')}
      </label>
      <label htmlFor={`${id}-file`}>{t('revenueImportUi.file')}</label>
      <input id={`${id}-file`} type="file" accept=".csv,text/csv" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void load(file);
      }} />
    </div>
    {error && <p role="alert" className="text-amber-300">{t(`revenueImportUi.errors.${error}`)}</p>}
  </details>;
};
