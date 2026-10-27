import React from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import { leavesDevice, type UsageSummary } from '@/services/llmEconomy';
import { useLlmEconomy } from './useLlmEconomy';

export interface LlmEconomyPanelProps {
  summary?: UsageSummary;
  projectId?: string | null;
  providerId?: string;
}

const usd = (value: number): string => `$${value.toFixed(2)}`;

export const LlmEconomyPanel: React.FC<LlmEconomyPanelProps> = ({ summary: explicitSummary, projectId, providerId = '' }) => {
  const { t } = useTranslation();
  const live = useLlmEconomy(projectId, providerId);
  const summary = explicitSummary ?? live.summary ?? { spentUsd: 0, savedUsd: 0, cacheHits: 0, calls: 0, remainingUsd: null, overBudget: false };
  const storageUnavailable = Boolean(live.projectId) && (
    live.storage?.budget === 'invalid' || live.storage?.budget === 'unavailable'
    || live.storage?.spend === 'invalid' || live.storage?.spend === 'unavailable'
  );

  return (
    <section className="space-y-2 rounded-lg border border-slate-800 p-4 text-sm text-slate-300" data-testid="llm-economy-panel">
      <h3 className="flex items-center gap-1 font-semibold text-slate-100">
        {t('llmEconomy.title')}
        <HelpTip id="llmEconomy.costGate" />
      </h3>
      {storageUnavailable ? (
        <p role="alert" className="text-amber-300">{t('llmEconomy.storageUnavailable')}</p>
      ) : summary.calls === 0 ? (
        <p>{t('llmEconomy.empty')}</p>
      ) : (
        <ul className="space-y-1">
          {(!summary.unknownCostCalls || summary.spentUsd > 0) && <li>{t('llmEconomy.spent', { value: usd(summary.spentUsd) })}</li>}
          <li>{t('llmEconomy.saved', { value: usd(summary.savedUsd) })}</li>
          <li>{t('llmEconomy.hits', { count: summary.cacheHits })}</li>
          {summary.remainingUsd !== null && <li>{t('llmEconomy.remaining', { value: usd(summary.remainingUsd) })}</li>}
          {!!summary.unknownCostCalls && <li role="alert" className="text-amber-300">{t('llmEconomy.unknownCost', { count: summary.unknownCostCalls })}</li>}
        </ul>
      )}
      {summary.overBudget && <p role="alert" className="text-rose-400">{t('llmEconomy.overBudget')}</p>}
      {leavesDevice(providerId) && <p role="alert" className="text-amber-300">{t('llmEconomy.leaves', { provider: providerId })}</p>}
    </section>
  );
};
