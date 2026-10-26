import React from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import { leavesDevice, type UsageSummary } from '@/services/llmEconomy';

export interface LlmEconomyPanelProps {
  summary: UsageSummary;
  providerId: string;
}

const usd = (value: number): string => `$${value.toFixed(2)}`;

export const LlmEconomyPanel: React.FC<LlmEconomyPanelProps> = ({ summary, providerId }) => {
  const { t } = useTranslation();
  return (
    <section className="space-y-2 rounded-lg border border-slate-800 p-4 text-sm text-slate-300" data-testid="llm-economy-panel">
      <h3 className="flex items-center gap-1 font-semibold text-slate-100">
        {t('llmEconomy.title')}
        <HelpTip id="llmEconomy.costGate" />
      </h3>
      {summary.calls === 0 ? (
        <p>{t('llmEconomy.empty')}</p>
      ) : (
        <ul className="space-y-1">
          <li>{t('llmEconomy.spent', { value: usd(summary.spentUsd) })}</li>
          <li>{t('llmEconomy.saved', { value: usd(summary.savedUsd) })}</li>
          <li>{t('llmEconomy.hits', { count: summary.cacheHits })}</li>
        </ul>
      )}
      {leavesDevice(providerId) && <p role="alert" className="text-amber-300">{t('llmEconomy.leaves', { provider: providerId })}</p>}
    </section>
  );
};
