import React from 'react';
import { Loader2 } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { AiProvider, AiConnectionState } from '@/types';
import type { ProviderDefinition } from './subscriptionModalTypes';
import { ProviderModelSelect } from '@/components/AI/ProviderModelSelect';

interface ProviderActiveControlsProps {
  item: ProviderDefinition;
  method: 'local_cli' | 'api_key';
  status: AiConnectionState;
  statusMessage: string | undefined;
  saving: boolean;
  onTestConnection: (id: AiProvider) => void;
  t: TFunction;
}

export const ProviderActiveControls: React.FC<ProviderActiveControlsProps> = ({
  item,
  method,
  status,
  statusMessage,
  saving,
  onTestConnection,
  t,
}) => {
  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      {method === 'api_key' ? (
        <ProviderModelSelect
          provider={item.id}
          ariaLabel={t('auth.modelLabel')}
          className="h-8 min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-white"
        />
      ) : (
        <span className="text-[11px] text-slate-400">
          {t('auth.localModelNote')}
        </span>
      )}
      <button
        type="button"
        disabled={status === 'testing' || saving}
        onClick={() => void onTestConnection(item.id)}
        className="flex h-8 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
      >
        {status === 'testing' || saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : null}
        {t('auth.testConnection')}
      </button>
      <span
        className={`text-[11px] ${
          status === 'connected'
            ? 'text-emerald-400'
            : status === 'error'
              ? 'text-rose-400'
              : 'text-slate-400'
        }`}
      >
        {statusMessage}
      </span>
    </div>
  );
};
