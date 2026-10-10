import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import { AIAssistantSuggestions } from '../assistant/AIAssistantSuggestions';
import { useOllamaAssistantSession } from './useOllamaAssistantSession';
import { LOCAL_OLLAMA_URL } from '@/services/embeddingClustering';

export const OllamaAssistantPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const session = useOllamaAssistantSession(open);
  const {
    t, projectId, currentAudit, model, models, version, status, error, suggestions, instruction, maxOutputTokens, loading,
    maxInstructionChars, setInstruction, handleModelChange, handleMaxOutputTokensChange, refreshDiscovery,
    handleGenerate, copiedJson, appliedField, applyTitle, applyDescription, copySchema,
  } = session;
  const statusText = status === 'loading'
    ? t('ollamaAssistantUi.status.loading')
    : status === 'ready'
      ? t('ollamaAssistantUi.status.ready', { version: version || '?' })
      : status === 'error'
        ? t('ollamaAssistantUi.status.error')
        : t('ollamaAssistantUi.status.idle');
  const canGenerate = Boolean(projectId && currentAudit && model && status === 'ready');

  return (
    <section className="border-t border-slate-800 pt-4" aria-labelledby="ollama-assistant-title">
      <button
        type="button"
        className="w-full flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span id="ollama-assistant-title" className="block text-xs font-bold text-white">{t('ollamaAssistantUi.title')}</span>
          <span className="mt-1 block text-[11px] text-slate-400">{t('ollamaAssistantUi.description')}</span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-300">
              {status === 'ready' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <span className="h-2 w-2 rounded-full bg-slate-500" />}
              {statusText}
            </span>
            <button type="button" onClick={() => void refreshDiscovery()} disabled={status === 'loading'} className="inline-flex items-center gap-1 text-emerald-400 disabled:opacity-50">
              <RefreshCw className="h-3 w-3" /> {t('ollamaAssistantUi.refresh')}
            </button>
          </div>
          <div className="text-[11px] text-slate-500">
            {t('ollamaAssistantUi.endpoint')}: <code className="text-slate-300">{LOCAL_OLLAMA_URL}</code>
          </div>
          <div>
            <label htmlFor="ollama-assistant-model" className="mb-1 block text-xs font-semibold text-slate-300">{t('ollamaAssistantUi.model')}</label>
            <select id="ollama-assistant-model" value={model} onChange={(event) => handleModelChange(event.target.value)} disabled={status !== 'ready' || models.length === 0} className="h-9 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs text-white disabled:opacity-50">
              <option value="">{models.length ? t('ollamaAssistantUi.chooseModel') : t('ollamaAssistantUi.noModels')}</option>
              {models.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ollama-assistant-max-tokens" className="mb-1 block text-xs font-semibold text-slate-300">{t('ollamaAssistantUi.maxOutputTokens')}</label>
            <input id="ollama-assistant-max-tokens" type="number" min={1} max={4096} step={1} value={maxOutputTokens} onChange={(event) => handleMaxOutputTokensChange(event.target.value)} className="h-9 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs text-white" />
          </div>
          <div>
            <label htmlFor="ollama-assistant-instruction" className="mb-1 block text-xs font-semibold text-slate-300">{t('ollamaAssistantUi.instruction')}</label>
            <input id="ollama-assistant-instruction" type="text" maxLength={maxInstructionChars} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder={t('ollamaAssistantUi.instructionPlaceholder')} className="h-9 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs text-white placeholder-slate-600" />
          </div>
          {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-300"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{error}</span></div>}
          <button type="button" onClick={() => void handleGenerate()} disabled={!canGenerate || loading} aria-busy={loading} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white disabled:opacity-50">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {t('ollamaAssistantUi.generate')}
          </button>
          {suggestions && <AIAssistantSuggestions suggestions={suggestions} applyTitle={applyTitle} applyDescription={applyDescription} appliedField={appliedField} copySchema={copySchema} copiedJson={copiedJson} t={t} />}
        </div>
      )}
    </section>
  );
};
