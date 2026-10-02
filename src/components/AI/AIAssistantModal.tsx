import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  X,
  Loader2,
  Bot,
  Check,
  Copy,
  ArrowRight,
  ShieldAlert,
  Key,
  Flame,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useAuditStore } from '@/stores/auditStore';
import { useAuthStore } from '@/stores/authStore';
import { AiSuggestionResponse } from '@/services/ai';
import { copyText } from '@/services/clipboard';
import { useModalA11y } from '@/hooks/useModalA11y';

export const AIAssistantModal: React.FC = () => {
  const { t } = useTranslation();
  const closeModal = useUIStore((s) => s.closeModal);
  const openModal = useUIStore((s) => s.openModal);
  const currentAudit = useAuditStore((s) => s.currentAudit);
  const setAuditData = useAuditStore((s) => s.setAuditData);

  const provider = useAuthStore((s) => s.provider);
  const setProvider = useAuthStore((s) => s.setProvider);
  const model = useAuthStore((s) => s.model);
  const setModel = useAuthStore((s) => s.setModel);
  const apiKeys = useAuthStore((s) => s.apiKeys);
  const setApiKey = useAuthStore((s) => s.setApiKey);
  const connectionMethod = useAuthStore((s) => s.connectionMethod);
  const isProviderConnected = useAuthStore((s) => s.isProviderConnected);
  const generateSuggestions = useAuthStore((s) => s.generateSuggestions);
  const dialogRef = useModalA11y<HTMLDivElement>(closeModal);

  const [promptInstruction, setPromptInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AiSuggestionResponse | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [appliedField, setAppliedField] = useState<'title' | 'desc' | null>(null);
  const generationRequestToken = useRef(0);

  const currentKey = apiKeys[provider] || '';

  useEffect(() => {
    generationRequestToken.current += 1;
    setLoading(false);
    setSuggestions(null);
  }, [provider, currentAudit?.timestamp]);

  const handleApiKeyChange = (value: string) => {
    void setApiKey(provider, value).catch((cause) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    });
  };

  const handleGenerate = async () => {
    if (!currentAudit) return;
    if (!isProviderConnected()) {
      setError(t('ai.connectBeforeGenerate', { provider: provider.toUpperCase() }));
      return;
    }

    const requestToken = ++generationRequestToken.current;
    setLoading(true);
    setError(null);

    try {
      const res = await generateSuggestions(currentAudit, promptInstruction);
      if (generationRequestToken.current === requestToken) setSuggestions(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (generationRequestToken.current === requestToken) setError(msg);
    } finally {
      if (generationRequestToken.current === requestToken) setLoading(false);
    }
  };

  const applyTitle = () => {
    if (!currentAudit || !suggestions) return;
    const updated = {
      ...currentAudit,
      meta_tags: {
        ...currentAudit.meta_tags,
        title: suggestions.suggestedTitle,
        title_length: suggestions.suggestedTitle.length,
      },
      open_graph: {
        ...currentAudit.open_graph,
        og_title: suggestions.suggestedTitle,
      },
    };
    setAuditData(updated);
    setAppliedField('title');
    setTimeout(() => setAppliedField(null), 2000);
  };

  const applyDescription = () => {
    if (!currentAudit || !suggestions) return;
    const updated = {
      ...currentAudit,
      meta_tags: {
        ...currentAudit.meta_tags,
        description: suggestions.suggestedDescription,
        description_length: suggestions.suggestedDescription.length,
      },
      open_graph: {
        ...currentAudit.open_graph,
        og_description: suggestions.suggestedDescription,
      },
    };
    setAuditData(updated);
    setAppliedField('desc');
    setTimeout(() => setAppliedField(null), 2000);
  };

  const copySchema = async () => {
    if (!suggestions?.schemaJsonLd) return;
    const copied = await copyText(JSON.stringify(suggestions.schemaJsonLd, null, 2));
    if (!copied) return;
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="ai-assistant-title" aria-describedby="ai-assistant-description" tabIndex={-1} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 id="ai-assistant-title" className="text-sm font-bold text-white">{t('ai.title')}</h3>
              <p id="ai-assistant-description" className="text-[11px] text-slate-400">
                {t('ai.description')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label={t('ai.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Provider Tabs */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">{t('ai.selectEngine')}</label>
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

          {/* Model Selector & API Key */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ai-model-select" className="text-xs font-semibold text-slate-300 block mb-1">{t('ai.modelLabel')}</label>
              {connectionMethod[provider] === 'local_cli' ? (
                <div
                  id="ai-model-select"
                  aria-label={t('ai.modelLabel')}
                  className="flex min-h-9 items-center rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 text-xs leading-4 text-emerald-200"
                >
                  {t('auth.localModelNote')}
                </div>
              ) : (
                <select
                  id="ai-model-select"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {provider === 'openai' && (
                    <>
                      <option value="gpt-4o">{t('legacyUi.ai.gpt4o')}</option>
                      <option value="gpt-4o-mini">{t('legacyUi.ai.gpt4oMini')}</option>
                      <option value="o3-mini">{t('legacyUi.ai.o3Mini')}</option>
                    </>
                  )}
                  {provider === 'claude' && (
                    <>
                      <option value="claude-opus-5">{t('legacyUi.ai.claudeOpus5')}</option>
                      <option value="claude-sonnet-5">{t('legacyUi.ai.claudeSonnet5')}</option>
                      <option value="claude-haiku-4-5">{t('legacyUi.ai.claudeHaiku45')}</option>
                    </>
                  )}
                  {provider === 'gemini' && (
                    <>
                      <option value="gemini-2.0-flash">{t('legacyUi.ai.geminiFlash')}</option>
                      <option value="gemini-2.0-pro-exp-02-05">{t('legacyUi.ai.geminiPro')}</option>
                      <option value="gemini-1.5-pro">{t('legacyUi.ai.gemini15')}</option>
                    </>
                  )}
                </select>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="ai-api-key" className="text-xs font-semibold text-slate-300">
                  {t('ai.apiKeyLabel', { provider: provider.toUpperCase() })}
                </label>
                <button
                  type="button"
                  onClick={() => openModal('subscription')}
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
                  placeholder={connectionMethod[provider] === 'local_cli'
                    ? t('ai.localCliPlaceholder')
                    : t('ai.apiKeyPlaceholder', { provider: provider.toUpperCase() })}
                  disabled={connectionMethod[provider] === 'local_cli'}
                  className="w-full h-9 pl-8 pr-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <Key className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* Optional Prompt Refinement */}
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

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !currentAudit}
            aria-busy={loading}
            className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('ai.checking', { provider: provider.toUpperCase() })}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{t('ai.generate')}</span>
              </>
            )}
          </button>

          {/* Suggestions Output Area */}
          {suggestions && (
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
                    <span className="text-xs font-semibold text-slate-300">{t('ai.schemaJsonLd')}</span>
                    <button
                      type="button"
                    onClick={() => void copySchema()}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] flex items-center space-x-1"
                    >
                      {copiedJson ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedJson ? t('ai.copied') : t('ai.copyJson')}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 bg-black/60 rounded font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-40">
                    {JSON.stringify(suggestions.schemaJsonLd, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
