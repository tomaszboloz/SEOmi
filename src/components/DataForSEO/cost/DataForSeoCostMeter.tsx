import React from 'react';
import { useTranslation } from 'react-i18next';
import { Coins } from 'lucide-react';
import { appLocale } from '@/services/localeFormat';
import { formatUsd, useDataForSeoCost } from './useDataForSeoCost';

const LEVEL_STYLE = {
  none: 'border-slate-800 bg-slate-900/60 text-slate-300',
  ok: 'border-slate-800 bg-slate-900/60 text-slate-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
  exceeded: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
} as const;

/**
 * Cost of the last DataForSEO call, month-to-date spend against the monthly
 * cap and the account balance. Shown in every view that sends paid requests.
 */
export const DataForSeoCostMeter: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { projectId, spend, budget, status, account } = useDataForSeoCost();
  if (!projectId || !spend || !budget || !status) return null;
  const locale = appLocale();
  const money = (value: number) => formatUsd(value, locale);

  return (
    <div role="status" aria-label={t('dataforseoCost.meterLabel')} className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-[11px] ${LEVEL_STYLE[status.level]} ${className}`}>
      <Coins className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
      <span>
        {spend.lastCall
          ? t('dataforseoCost.lastCall', { cost: money(spend.lastCall.costUsd), endpoint: spend.lastCall.endpoint.replace(/^\/v3\//, '') })
          : t('dataforseoCost.noCallsYet')}
      </span>
      <span>
        {budget.monthlyLimitUsd === null
          ? t('dataforseoCost.monthNoLimit', { spent: money(spend.totalUsd), calls: spend.calls })
          : t('dataforseoCost.monthWithLimit', { spent: money(spend.totalUsd), limit: money(budget.monthlyLimitUsd), percent: Math.round(status.percent ?? 0) })}
      </span>
      {account && <span>{t('dataforseoCost.balance', { balance: money(account.estimatedBalanceUsd) })}</span>}
      {status.level === 'warning' && <span className="font-semibold">{t('dataforseoCost.warning')}</span>}
      {status.level === 'exceeded' && <span className="font-semibold">{t('dataforseoCost.exceeded')}</span>}
    </div>
  );
};
