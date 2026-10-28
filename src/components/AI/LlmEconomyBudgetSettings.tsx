import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_LLM_MONTHLY_LIMIT_USD, writeLlmBudget } from '@/services/llmEconomy';
import { useLlmEconomy } from './useLlmEconomy';

const field = 'h-9 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 text-white';

/** Project-scoped writer for the optional LLM monthly cap. */
export const LlmEconomyBudgetSettings: React.FC = () => {
  const { t } = useTranslation();
  const { projectId, budget, storage } = useLlmEconomy();
  const [noLimit, setNoLimit] = useState(true);
  const [limit, setLimit] = useState('');
  const [warnAt, setWarnAt] = useState('80');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setNoLimit(!budget || budget.monthlyLimitUsd === null);
    setLimit(budget?.monthlyLimitUsd === null || !budget ? '' : String(budget.monthlyLimitUsd));
    setWarnAt(String(budget?.warnAtPercent ?? 80));
  }, [projectId, budget?.monthlyLimitUsd, budget?.warnAtPercent]);

  if (!projectId) return <p className="text-[11px] text-slate-400">{t('llmEconomy.selectProject')}</p>;
  if (!storage || storage.budget === 'invalid' || storage.budget === 'unavailable') return <p role="alert" className="text-[11px] text-amber-300">{t('llmEconomy.storageUnavailable')}</p>;
  if (!budget) return <p className="text-[11px] text-slate-400">{t('llmEconomy.selectProject')}</p>;
  const save = () => {
    const value = noLimit ? null : Number(limit.replace(',', '.'));
    try {
      if (value !== null && (!limit.trim() || !Number.isFinite(value) || value < 0 || value > MAX_LLM_MONTHLY_LIMIT_USD)) throw new Error(t('llmEconomy.invalidLimit'));
      writeLlmBudget(projectId, { monthlyLimitUsd: value, warnAtPercent: Number(warnAt) });
      setMessage(t('llmEconomy.savedBudget'));
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };

  return <section aria-labelledby="llm-budget-title" className="space-y-2 border-t border-slate-800 pt-3">
    <h5 id="llm-budget-title" className="font-semibold text-white">{t('llmEconomy.budgetTitle')}</h5>
    <label className="flex items-center gap-2 text-slate-200"><input type="checkbox" checked={noLimit} onChange={(event) => setNoLimit(event.target.checked)} />{t('llmEconomy.noLimit')}</label>
    {!noLimit && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-slate-400">{t('llmEconomy.limitLabel')}<input inputMode="decimal" value={limit} onChange={(event) => setLimit(event.target.value)} className={`${field} mt-1`} /></label>
      <label className="text-slate-400">{t('llmEconomy.warnLabel')}<input type="number" min={1} max={100} value={warnAt} onChange={(event) => setWarnAt(event.target.value)} className={`${field} mt-1`} /></label>
    </div>}
    <button type="button" onClick={save} className="inline-flex h-8 rounded-lg bg-emerald-600 px-3 font-semibold text-white">{t('llmEconomy.saveBudget')}</button>
    {message && <p role="status" className="text-[11px] text-slate-300">{message}</p>}
  </section>;
};
