import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AioSnapshot } from '@/services/aioReadiness/history';
import { copyText } from '@/services/clipboard';
import { AIO_SWEEP_MIN_LABELLED, aioLabellingCsv, aioLabellingPairs, parseAioLabellingCsv, sweepAioThresholds, type AioSweepReport, type AioLabellingParse } from '@/services/monitoringAlerts';

type CopyState = 'idle' | 'copied' | 'failed';
const BUTTON = 'rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50';

/** Human labelling of real before/after AIO score pairs for drop-alert calibration (#108). Never changes the threshold. */
export const AioCalibrationLabels = ({ history }: { history: AioSnapshot[] }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const inputId = useId();
  const pairs = useMemo(() => aioLabellingPairs(history), [history]);
  const [copy, setCopy] = useState<CopyState>('idle');
  const [sheet, setSheet] = useState('');
  const [result, setResult] = useState<{ parsed: AioLabellingParse; sweep: AioSweepReport } | null>(null);
  const copySheet = async () => setCopy((await copyText(aioLabellingCsv(pairs))) ? 'copied' : 'failed');
  const check = () => {
    const parsed = parseAioLabellingCsv(sheet);
    setResult({ parsed, sweep: sweepAioThresholds(parsed.cases) });
  };
  return (
    <section aria-labelledby={titleId} className="space-y-2 rounded border border-slate-800 p-3 text-xs text-slate-300" data-testid="aio-calibration">
      <h4 id={titleId} className="font-semibold text-slate-200">{t('aio.calibration.title')}</h4>
      <p className="text-slate-400">{t('aio.calibration.intro', { min: AIO_SWEEP_MIN_LABELLED })}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BUTTON} disabled={!pairs.length} onClick={() => { void copySheet(); }}>{t('aio.calibration.copy', { count: pairs.length })}</button>
        {copy !== 'idle' && <span role="status">{t(`aio.calibration.${copy}`)}</span>}
      </div>
      <label htmlFor={inputId} className="block text-slate-400">{t('aio.calibration.paste')}</label>
      <textarea id={inputId} value={sheet} onChange={(event) => setSheet(event.target.value)} rows={4} className="w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" />
      <button type="button" className={BUTTON} disabled={!sheet.trim()} onClick={check}>{t('aio.calibration.check')}</button>
      {result && (
        <div role="status" className="space-y-1" data-testid="aio-calibration-result">
          <p>{t('aio.calibration.counts', { labelled: result.sweep.labelled, alert: result.sweep.alertLabels, noAlert: result.sweep.noAlertLabels, unlabelled: result.parsed.unlabelled })}</p>
          {result.parsed.errors.length > 0 && <p className="text-amber-200">{t('aio.calibration.errors', { lines: result.parsed.errors.map((error) => error.line).join(', ') })}</p>}
          <p className="text-slate-200">{result.sweep.status === 'recommended'
            ? t('aio.calibration.recommended', { threshold: result.sweep.recommended })
            : t(`aio.calibration.${result.sweep.status}`, { min: AIO_SWEEP_MIN_LABELLED })}</p>
        </div>
      )}
    </section>
  );
};
