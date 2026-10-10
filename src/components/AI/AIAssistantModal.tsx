import React from 'react';
import { Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useAIAssistantSession } from './assistant/useAIAssistantSession';
import { AIAssistantModalHeader } from './assistant/AIAssistantModalHeader';
import { AIAssistantEngineSelect } from './assistant/AIAssistantEngineSelect';
import { AIAssistantApiKeyInput } from './assistant/AIAssistantApiKeyInput';
import { AIAssistantSuggestions } from './assistant/AIAssistantSuggestions';
import { OllamaAssistantPanel } from './ollama/OllamaAssistantPanel';

export const AIAssistantModal: React.FC = () => {
  const session = useAIAssistantSession();
  const {
    t,
    closeModal,
    openSubscriptionModal,
    currentAudit,
    provider,
    setProvider,
    connectionMethod,
    currentKey,
    handleApiKeyChange,
    promptInstruction,
    setPromptInstruction,
    loading,
    error,
    suggestions,
    copiedJson,
    appliedField,
    handleGenerate,
    applyTitle,
    applyDescription,
    copySchema,
  } = session;

  const dialogRef = useModalA11y<HTMLDivElement>(closeModal);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-assistant-title"
        aria-describedby="ai-assistant-description"
        tabIndex={-1}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        <AIAssistantModalHeader closeModal={closeModal} t={t} />

        <div className="p-6 overflow-y-auto space-y-5">
          <AIAssistantEngineSelect
            provider={provider}
            setProvider={setProvider}
            connectionMethod={connectionMethod}
            t={t}
          />

          <AIAssistantApiKeyInput
            provider={provider}
            currentKey={currentKey}
            handleApiKeyChange={handleApiKeyChange}
            connectionMethod={connectionMethod}
            openSubscriptionModal={openSubscriptionModal}
            promptInstruction={promptInstruction}
            setPromptInstruction={setPromptInstruction}
            t={t}
          />

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

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

          {suggestions && (
            <AIAssistantSuggestions
              suggestions={suggestions}
              applyTitle={applyTitle}
              applyDescription={applyDescription}
              appliedField={appliedField}
              copySchema={copySchema}
              copiedJson={copiedJson}
              t={t}
            />
          )}

          {currentAudit && <OllamaAssistantPanel />}
        </div>
      </div>
    </div>
  );
};
