import React from 'react';
import { Check } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { AiProvider, AiCliStatus, AiConnectionState } from '@/types';
import type { ProviderDefinition } from './subscriptionModalTypes';
import { ProviderMethodButtons } from './ProviderMethodButtons';
import { ProviderActiveControls } from './ProviderActiveControls';

interface SubscriptionProviderCardProps {
  item: ProviderDefinition;
  active: boolean;
  method: 'local_cli' | 'api_key';
  cli: AiCliStatus | null | undefined;
  status: AiConnectionState;
  statusMessage: string | undefined;
  apiKey: string;
  model: string;
  saving: boolean;
  onSetProvider: (id: AiProvider) => void;
  onSetMethod: (id: AiProvider, method: 'local_cli' | 'api_key') => void;
  onSaveKey: (id: AiProvider, key: string) => void;
  onSetModel: (model: string) => void;
  onTestConnection: (id: AiProvider) => void;
  t: TFunction;
}

export const SubscriptionProviderCard: React.FC<SubscriptionProviderCardProps> = ({
  item,
  active,
  method,
  cli,
  status,
  statusMessage,
  apiKey,
  model,
  saving,
  onSetProvider,
  onSetMethod,
  onSaveKey,
  onSetModel,
  onTestConnection,
  t,
}) => {
  const Icon = item.icon;

  return (
    <section
      className={`rounded-2xl border p-5 ${
        active
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-slate-800 bg-slate-950/50'
      }`}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-emerald-400">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">{t(item.nameKey)}</h4>
            <p className="text-xs text-slate-400">
              {t('auth.selectConnectionMethod')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSetProvider(item.id)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            active
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          {active ? (
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3" />
              {t('auth.active')}
            </span>
          ) : (
            t('auth.useProvider')
          )}
        </button>
      </div>

      <ProviderMethodButtons
        item={item}
        method={method}
        cli={cli}
        onSetMethod={onSetMethod}
        t={t}
      />

      {method === 'api_key' && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            aria-label={t('auth.apiKeyLabel', { provider: t(item.nameKey) })}
            type="password"
            value={apiKey}
            onChange={(event) => void onSaveKey(item.id, event.target.value)}
            placeholder={t('auth.apiKeyPlaceholder')}
            className="h-9 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 font-mono text-xs text-white"
          />
          <a
            href={item.apiHelp}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-center text-xs text-emerald-300"
          >
            {t('auth.manageApiKey')}
          </a>
        </div>
      )}

      {active && (
        <ProviderActiveControls
          item={item}
          method={method}
          status={status}
          statusMessage={statusMessage}
          model={model}
          saving={saving}
          onSetModel={onSetModel}
          onTestConnection={onTestConnection}
          t={t}
        />
      )}
    </section>
  );
};
