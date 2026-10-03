import React from 'react';
import { Bot, Loader2, Sparkles } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { AiResearchSettings } from '@/services/aiResearchEvidence';

interface AiBrandInputFormProps {
  brand: string;
  domain: string;
  prompts: string;
  competitors: string;
  researchSettings: AiResearchSettings;
  isLoading: boolean;
  onChangeBrand: (value: string) => void;
  onChangeDomain: (value: string) => void;
  onChangePrompts: (value: string) => void;
  onChangeCompetitors: (value: string) => void;
  onUpdateResearchSettings: (patch: Partial<AiResearchSettings>) => void;
  onSubmit: (e: React.FormEvent) => void;
  t: TFunction;
}

export const AiBrandInputForm: React.FC<AiBrandInputFormProps> = ({
  brand,
  domain,
  prompts,
  competitors,
  researchSettings,
  isLoading,
  onChangeBrand,
  onChangeDomain,
  onChangePrompts,
  onChangeCompetitors,
  onUpdateResearchSettings,
  onSubmit,
  t,
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-wrap gap-3 shadow-lg"
    >
      <div className="flex-1 relative">
        <Bot className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          aria-label={t('aiVisibility.brand.brandLabel')}
          value={brand}
          onChange={(e) => onChangeBrand(e.target.value)}
          placeholder={t('aiVisibility.brand.brandPlaceholder')}
          className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
        />
      </div>

      <div className="w-full md:w-64 relative">
        <input
          type="text"
          aria-label={t('aiVisibility.brand.domainLabel')}
          value={domain}
          onChange={(e) => onChangeDomain(e.target.value)}
          placeholder={t('aiVisibility.brand.domainPlaceholder')}
          className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-mono"
        />
      </div>

      <div className="grid w-full gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs text-slate-300">
          {t('aiResearch.prompts')}
          <textarea
            aria-label={t('aiResearch.prompts')}
            rows={4}
            value={prompts}
            onChange={(e) => onChangePrompts(e.target.value)}
            onBlur={() => onUpdateResearchSettings({ prompts: prompts.split(/\n/) })}
            placeholder={t('aiResearch.promptsPlaceholder')}
            className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white"
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-300">
          {t('aiResearch.competitors')}
          <textarea
            aria-label={t('aiResearch.competitors')}
            rows={4}
            value={competitors}
            onChange={(e) => onChangeCompetitors(e.target.value)}
            onBlur={() => onUpdateResearchSettings({ competitors: competitors.split(/\n/) })}
            className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white"
          />
        </label>
        <label className="flex items-center gap-3 text-xs text-slate-300">
          {t('aiResearch.repetitions')}
          <input
            aria-label={t('aiResearch.repetitions')}
            type="number"
            min={1}
            max={5}
            value={researchSettings.repetitions}
            onChange={(e) => onUpdateResearchSettings({ repetitions: Number(e.target.value) })}
            className="w-20 rounded border border-slate-700 bg-slate-950 p-2"
          />
        </label>
        <p className="text-xs text-slate-400">{t('aiResearch.methodologyNote')}</p>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center space-x-2 transition shadow-md shadow-emerald-950"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t('aiVisibility.brand.queryLoading')}</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            <span>{t('aiVisibility.brand.analyze')}</span>
          </>
        )}
      </button>
    </form>
  );
};
