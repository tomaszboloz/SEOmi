import React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import type { AiProvider } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { modelOptionsFor } from '@/services/ai/modelList';

interface ProviderModelSelectProps {
  provider: AiProvider;
  id?: string;
  ariaLabel: string;
  className: string;
}

/**
 * Model choice for an API-key connection. Lists the models the provider's API
 * returned for the stored key; before the first successful listing it offers
 * current defaults. The selected model always stays in the list.
 */
export const ProviderModelSelect: React.FC<ProviderModelSelectProps> = ({ provider, id, ariaLabel, className }) => {
  const { t } = useTranslation();
  const model = useAuthStore((s) => s.model);
  const setModel = useAuthStore((s) => s.setModel);
  const fetched = useAuthStore((s) => s.availableModels[provider]);
  const status = useAuthStore((s) => s.modelListStatus[provider]);
  const hasKey = useAuthStore((s) => Boolean(s.apiKeys[provider].trim()));
  const refresh = useAuthStore((s) => s.refreshProviderModels);
  const options = modelOptionsFor(provider, fetched, model);

  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-1.5">
        <select id={id} aria-label={ariaLabel} value={model} onChange={(event) => setModel(event.target.value)} className={className}>
          {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => void refresh(provider)}
          disabled={!hasKey || status === 'loading'}
          aria-label={t('auth.refreshModels')}
          title={t('auth.refreshModels')}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${status === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      </span>
      <span role={status === 'error' ? 'alert' : undefined} className={`text-[10px] ${status === 'error' ? 'text-amber-300' : 'text-slate-500'}`}>
        {status === 'error' ? t('auth.modelsUnavailable') : fetched?.length ? t('auth.modelsFromProvider', { count: fetched.length }) : t('auth.modelsDefault')}
      </span>
    </span>
  );
};
