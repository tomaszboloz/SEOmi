import React from 'react';
import type { TFunction } from 'i18next';
import { Bot, Flame, Sparkles } from 'lucide-react';
import type { AiProvider } from '@/types';
import { ProviderModelSelect } from '@/components/AI/ProviderModelSelect';

interface Props {
  provider: AiProvider;
  setProvider: (provider: AiProvider) => void;
  connectionMethod: Record<AiProvider, string>;
  t: TFunction;
}

export const AIAssistantEngineSelect: React.FC<Props> = ({
  provider,
  setProvider,
  connectionMethod,
  t,
}) => (
  <div className="space-y-3">
    {/* Provider Tabs */}
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-300 block">
        {t('ai.selectEngine')}
      </label>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setProvider('openai')}
          aria-pressed={provider === 'openai'}
          className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition ${
            provider === 'openai'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>{t('legacyUi.ai.openai')}</span>
        </button>

        <button
          type="button"
          onClick={() => setProvider('claude')}
          aria-pressed={provider === 'claude'}
          className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition ${
            provider === 'claude'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/40'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>{t('legacyUi.ai.claude')}</span>
        </button>

        <button
          type="button"
          onClick={() => setProvider('gemini')}
          aria-pressed={provider === 'gemini'}
          className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition ${
            provider === 'gemini'
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/40'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t('legacyUi.ai.gemini')}</span>
        </button>
      </div>
    </div>

    {/* Model Selector */}
    <div>
      <label htmlFor="ai-model-select" className="text-xs font-semibold text-slate-300 block mb-1">
        {t('ai.modelLabel')}
      </label>
      {connectionMethod[provider] === 'local_cli' ? (
        <div
          id="ai-model-select"
          aria-label={t('ai.modelLabel')}
          className="flex min-h-9 items-center rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 text-xs leading-4 text-emerald-200"
        >
          {t('auth.localModelNote')}
        </div>
      ) : (
        <ProviderModelSelect
          provider={provider}
          id="ai-model-select"
          ariaLabel={t('ai.modelLabel')}
          className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      )}
    </div>
  </div>
);
