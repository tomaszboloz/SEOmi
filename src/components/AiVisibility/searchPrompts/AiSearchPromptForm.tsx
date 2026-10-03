import React from 'react';
import { Loader2, MessageSquare, Sparkles } from 'lucide-react';
import type { TFunction } from 'i18next';

interface AiSearchPromptFormProps {
  prompt: string;
  isLoading: boolean;
  samplePrompts: string[];
  onChangePrompt: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSelectSample: (sample: string) => void;
  t: TFunction;
}

export const AiSearchPromptForm: React.FC<AiSearchPromptFormProps> = ({
  prompt,
  isLoading,
  samplePrompts,
  onChangePrompt,
  onSubmit,
  onSelectSample,
  t,
}) => {
  return (
    <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 shadow-lg">
      <form onSubmit={onSubmit} className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <MessageSquare className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            aria-label={t('aiVisibility.search.promptLabel')}
            value={prompt}
            onChange={(e) => onChangePrompt(e.target.value)}
            placeholder={t('aiVisibility.search.promptPlaceholder')}
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center space-x-2 transition shadow-md shadow-emerald-950"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('aiVisibility.search.runLoading')}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{t('aiVisibility.search.run')}</span>
            </>
          )}
        </button>
      </form>

      {/* Sample Prompt Pills */}
      <div className="flex items-center flex-wrap gap-1.5 pt-1">
        <span className="text-[11px] text-slate-400">{t('aiVisibility.search.samplesLabel')}</span>
        {samplePrompts.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelectSample(p)}
            className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition truncate max-w-xs"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
};
