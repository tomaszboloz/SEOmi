import React from 'react';
import type { TFunction } from 'i18next';
import { Key } from 'lucide-react';
import type { AiProvider } from '@/types';

interface Props {
  provider: AiProvider;
  currentKey: string;
  handleApiKeyChange: (key: string) => void;
  connectionMethod: Record<AiProvider, string>;
  openSubscriptionModal: () => void;
  promptInstruction: string;
  setPromptInstruction: (instruction: string) => void;
  t: TFunction;
}

export const AIAssistantApiKeyInput: React.FC<Props> = ({
  provider,
  currentKey,
  handleApiKeyChange,
  connectionMethod,
  openSubscriptionModal,
  promptInstruction,
  setPromptInstruction,
  t,
}) => (
  <div className="space-y-3">
    <div>
      <div className="flex items-center justify-between mb-1">
        <label htmlFor="ai-api-key" className="text-xs font-semibold text-slate-300">
          {t('ai.apiKeyLabel', { provider: provider.toUpperCase() })}
        </label>
        <button
          type="button"
          onClick={openSubscriptionModal}
          className="text-[11px] text-emerald-400 hover:underline"
        >
          {t('ai.manageSubscriptions')}
        </button>
      </div>
      <div className="relative">
        <input
          id="ai-api-key"
          type="password"
          value={currentKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          placeholder={
            connectionMethod[provider] === 'local_cli'
              ? t('ai.localCliPlaceholder')
              : t('ai.apiKeyPlaceholder', { provider: provider.toUpperCase() })
          }
          disabled={connectionMethod[provider] === 'local_cli'}
          className="w-full h-9 pl-8 pr-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <Key className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
      </div>
    </div>

    <div>
      <label htmlFor="ai-custom-instruction" className="text-xs font-semibold text-slate-300 block mb-1">
        {t('ai.customInstruction')}
      </label>
      <input
        id="ai-custom-instruction"
        type="text"
        value={promptInstruction}
        onChange={(e) => setPromptInstruction(e.target.value)}
        placeholder={t('ai.customInstructionPlaceholder')}
        className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  </div>
);
