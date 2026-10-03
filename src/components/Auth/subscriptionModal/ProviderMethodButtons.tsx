import React from 'react';
import { KeyRound, Terminal } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { AiProvider, AiCliStatus } from '@/types';
import type { ProviderDefinition } from './subscriptionModalTypes';

interface ProviderMethodButtonsProps {
  item: ProviderDefinition;
  method: 'local_cli' | 'api_key';
  cli: AiCliStatus | null | undefined;
  onSetMethod: (id: AiProvider, method: 'local_cli' | 'api_key') => void;
  t: TFunction;
}

export const ProviderMethodButtons: React.FC<ProviderMethodButtonsProps> = ({
  item,
  method,
  cli,
  onSetMethod,
  t,
}) => {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <button
        type="button"
        onClick={() => onSetMethod(item.id, 'local_cli')}
        className={`rounded-xl border p-3 text-left ${
          method === 'local_cli'
            ? 'border-emerald-500/40 bg-emerald-500/10'
            : 'border-slate-800 bg-slate-900/60'
        }`}
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-white">
          <Terminal className="h-3.5 w-3.5 text-emerald-400" />{' '}
          {t('auth.localCliSubscription')}
        </span>
        <span className="mt-1 block text-[11px] leading-4 text-slate-400">
          {t('auth.localCliDescription', { command: item.command })}{' '}
          {cli?.available
            ? `${t('auth.detected')}: ${cli.detail}`
            : cli?.detail || t('auth.checkingAvailability')}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onSetMethod(item.id, 'api_key')}
        className={`rounded-xl border p-3 text-left ${
          method === 'api_key'
            ? 'border-emerald-500/40 bg-emerald-500/10'
            : 'border-slate-800 bg-slate-900/60'
        }`}
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-white">
          <KeyRound className="h-3.5 w-3.5 text-emerald-400" />{' '}
          {t('auth.directApiCredential')}
        </span>
        <span className="mt-1 block text-[11px] leading-4 text-slate-400">
          {t('auth.apiDescription')}
        </span>
      </button>
    </div>
  );
};
