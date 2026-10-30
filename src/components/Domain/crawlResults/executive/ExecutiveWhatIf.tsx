import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { simulateHss, type HssModule, type HssReport } from '@/services/hss';

const parse = (raw: string): number | null => {
  const value = Number(raw);
  return raw.trim() === '' || !Number.isFinite(value) ? null : value;
};

/**
 * What-If (#72 GEM-72-07, #73 workflow step 4): edits measured module values on a copy of this run's
 * inputs. Nothing is stored, the baseline is never changed and the result is not a traffic forecast.
 */
export const ExecutiveWhatIf = ({ hss }: { hss: HssReport }) => {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<Partial<Record<HssModule, string>>>({});
  const measured = hss.components.filter((item) => item.status === 'measured');
  const changes = useMemo(() => Object.fromEntries(Object.entries(drafts)
    .map(([module, raw]) => [module, parse(raw ?? '')] as const)
    .filter(([, value]) => value !== null && value >= 0 && value <= 100)) as Partial<Record<HssModule, number>>, [drafts]);
  const result = useMemo(() => simulateHss(hss, changes), [hss, changes]);
  if (!measured.length) return null;
  const delta = result.delta === null ? null : `${result.delta > 0 ? '+' : ''}${result.delta}`;
  return (
    <section aria-labelledby="executive-whatif-title" className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="executive-whatif-title" className="text-sm font-semibold text-slate-200">{t('executive.whatIf.title')}</h2>
      <p className="text-xs text-slate-400">{t('executive.whatIf.hint')}</p>
      <div className="flex flex-wrap gap-3">
        {measured.map((item) => (
          <label key={item.module} className="flex flex-col gap-1 text-xs text-slate-300">
            {t(`executive.module.${item.module}`)}
            <input
              type="number" min={0} max={100} step={1} inputMode="decimal"
              value={drafts[item.module] ?? String(item.value)}
              onChange={(event) => setDrafts((current) => ({ ...current, [item.module]: event.target.value }))}
              className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            />
          </label>
        ))}
      </div>
      <p role="status" aria-live="polite" className="text-xs text-slate-200">
        {result.scenario.value === null ? t('executive.whatIf.unavailable') : t('executive.whatIf.result', { value: result.scenario.value, delta: delta ?? '—' })}
      </p>
      <button type="button" onClick={() => setDrafts({})} className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
        {t('executive.whatIf.reset')}
      </button>
    </section>
  );
};
