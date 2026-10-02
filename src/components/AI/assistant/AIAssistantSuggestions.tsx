import React from 'react';
import type { TFunction } from 'i18next';
import { ArrowRight, Check, Copy } from 'lucide-react';
import type { AiSuggestionResponse } from '@/services/ai';

interface Props {
  suggestions: AiSuggestionResponse;
  applyTitle: () => void;
  applyDescription: () => void;
  appliedField: 'title' | 'desc' | null;
  copySchema: () => void;
  copiedJson: boolean;
  t: TFunction;
}

export const AIAssistantSuggestions: React.FC<Props> = ({
  suggestions,
  applyTitle,
  applyDescription,
  appliedField,
  copySchema,
  copiedJson,
  t,
}) => (
  <div className="space-y-4 pt-3 border-t border-slate-800 animate-in fade-in">
    <div className="flex items-center justify-between">
      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
        <Check className="w-3.5 h-3.5 text-emerald-400" />
        <span>{t('ai.suggestions')}</span>
      </h4>
    </div>

    {/* Title Suggestion */}
    <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-300">{t('ai.suggestedTitle')}</span>
        <span className="text-[11px] font-mono text-emerald-400">
          {t('ai.characters', { count: suggestions.suggestedTitle.length })}
        </span>
      </div>
      <p className="text-xs text-white font-medium break-words">
        {suggestions.suggestedTitle}
      </p>
      <button
        type="button"
        onClick={applyTitle}
        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-[11px] font-medium transition flex items-center space-x-1"
      >
        {appliedField === 'title' ? (
          <Check className="w-3 h-3 text-emerald-400" />
        ) : (
          <ArrowRight className="w-3 h-3" />
        )}
        <span>{appliedField === 'title' ? t('ai.applied') : t('ai.applyTitle')}</span>
      </button>
    </div>

    {/* Description Suggestion */}
    <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-300">{t('ai.suggestedDescription')}</span>
        <span className="text-[11px] font-mono text-emerald-400">
          {t('ai.characters', { count: suggestions.suggestedDescription.length })}
        </span>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed break-words">
        {suggestions.suggestedDescription}
      </p>
      <button
        type="button"
        onClick={applyDescription}
        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-[11px] font-medium transition flex items-center space-x-1"
      >
        {appliedField === 'desc' ? (
          <Check className="w-3 h-3 text-emerald-400" />
        ) : (
          <ArrowRight className="w-3 h-3" />
        )}
        <span>{appliedField === 'desc' ? t('ai.applied') : t('ai.applyDesc')}</span>
      </button>
    </div>

    {/* Key Improvements List */}
    {suggestions.keyImprovements.length > 0 && (
      <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
        <span className="text-xs font-semibold text-slate-300 block mb-1">
          {t('ai.keyImprovements')}
        </span>
        <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
          {suggestions.keyImprovements.map((imp, i) => (
            <li key={i}>{imp}</li>
          ))}
        </ul>
      </div>
    )}

    {/* Generated Schema JSON-LD */}
    {suggestions.schemaJsonLd && (
      <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">
            {t('ai.schemaJsonLd')}
          </span>
          <button
            type="button"
            onClick={copySchema}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] flex items-center space-x-1"
          >
            {copiedJson ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>{copiedJson ? t('ai.copied') : t('ai.copyJson')}</span>
          </button>
        </div>
        <pre className="p-2.5 bg-black/60 rounded font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-40">
          {JSON.stringify(suggestions.schemaJsonLd, null, 2)}
        </pre>
      </div>
    )}
  </div>
);
