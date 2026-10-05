import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { DataForSEOClient } from '@/services/dataforseo';
import { MAX_MONTHLY_LIMIT_USD, writeBudget } from '@/services/dataforseo/dataforseoBudget';
import { appLocale } from '@/services/localeFormat';
import { formatUsd, useDataForSeoCost } from './useDataForSeoCost';

const field = 'h-9 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 text-white';

/** Account balance, month-to-date spend and the project's monthly DataForSEO cap. */
export const DataForSeoBudgetSettings: React.FC = () => {
  const { t } = useTranslation();
  const credentials = useSettingsStore((state) => state.dataForSeoCredentials);
  const { projectId, spend, budget, status, account } = useDataForSeoCost();
  const [limitInput, setLimitInput] = useState('');
  const [noLimit, setNoLimit] = useState(true);
  const [warnInput, setWarnInput] = useState('80');
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setNoLimit(!budget || budget.monthlyLimitUsd === null);
    setLimitInput(budget?.monthlyLimitUsd === null || !budget ? '' : String(budget.monthlyLimitUsd));
    setWarnInput(String(budget?.warnAtPercent ?? 80));
  }, [projectId, budget?.monthlyLimitUsd, budget?.warnAtPercent]);

  if (!projectId || !spend || !budget || !status) return <p className="text-[11px] text-slate-400">{t('dataforseoCost.selectProject')}</p>;
  const money = (value: number) => formatUsd(value, appLocale());

  const save = () => {
    const limit = noLimit ? null : Number(limitInput.replace(',', '.'));
    try {
      if (limit !== null && (!limitInput.trim() || !Number.isFinite(limit) || limit < 0 || limit > MAX_MONTHLY_LIMIT_USD)) throw new Error(t('dataforseoCost.invalidLimit'));
      writeBudget(projectId, { monthlyLimitUsd: limit, warnAtPercent: Number(warnInput) });
      setMessage(limit === null ? t('dataforseoCost.limitRemoved') : t('dataforseoCost.limitSaved', { limit: money(limit) }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const checkBalance = async () => {
    if (!credentials.login || !credentials.password) return setMessage(t('dataforseo.enterCredentials'));
    setChecking(true);
    setMessage(null);
    try {
      const fetched = await new DataForSEOClient(credentials.login, credentials.password).getAccount();
      setMessage(fetched ? null : t('dataforseoCost.balanceUnavailable'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  };

  return (
    <section aria-labelledby="dataforseo-budget-title" className="space-y-3 border-t border-slate-800 pt-3">
      <h5 id="dataforseo-budget-title" className="font-semibold text-white">{t('dataforseoCost.settingsTitle')}</h5>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div><dt className="text-slate-500">{t('dataforseoCost.balanceLabel')}</dt><dd className="font-mono text-white">{account ? money(account.estimatedBalanceUsd) : '—'}</dd>
          {account && <dd className="text-[10px] text-slate-500">{t('dataforseoCost.balanceChecked', { balance: money(account.balanceUsd), date: new Date(account.fetchedAt).toLocaleString(appLocale()) })}</dd>}</div>
        <div><dt className="text-slate-500">{t('dataforseoCost.monthLabel', { month: spend.month })}</dt><dd className="font-mono text-white">{money(spend.totalUsd)}</dd>
          <dd className="text-[10px] text-slate-500">{t('dataforseoCost.calls', { count: spend.calls })}</dd></div>
        <div><dt className="text-slate-500">{t('dataforseoCost.remainingLabel')}</dt><dd className="font-mono text-white">{status.remainingUsd !== null ? money(status.remainingUsd) : account ? money(Math.max(0, account.estimatedBalanceUsd)) : t('dataforseoCost.noLimit')}</dd></div>
      </dl>
      <button type="button" onClick={() => void checkBalance()} disabled={checking} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-slate-200 disabled:opacity-50">
        {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{t('dataforseoCost.checkBalance')}
      </button>
      <label className="flex items-center gap-2 text-slate-200">
        <input type="checkbox" checked={noLimit} onChange={(event) => setNoLimit(event.target.checked)} className="accent-emerald-400" />
        {t('dataforseoCost.noLimitOption')}
      </label>
      {!noLimit && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-slate-400">{t('dataforseoCost.limitLabel')}
            <input inputMode="decimal" value={limitInput} onChange={(event) => setLimitInput(event.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="block text-slate-400">{t('dataforseoCost.warnLabel')}
            <input type="number" min={1} max={100} step={1} value={warnInput} onChange={(event) => setWarnInput(event.target.value)} className={`${field} mt-1`} />
          </label>
        </div>
      )}
      <p className="text-[11px] leading-4 text-slate-500">{t('dataforseoCost.limitHelp')}</p>
      <button type="button" onClick={save} className="inline-flex h-8 items-center rounded-lg bg-emerald-600 px-3 font-semibold text-white hover:bg-emerald-500">{t('dataforseoCost.saveLimit')}</button>
      {message && <p role="status" className="text-[11px] text-slate-300">{message}</p>}
    </section>
  );
};
