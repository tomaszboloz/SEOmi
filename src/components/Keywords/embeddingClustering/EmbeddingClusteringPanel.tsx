import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { defaultEmbeddingThreshold, EMBEDDING_PROVIDERS, MAX_EMBEDDING_KEYWORDS, type EmbeddingProviderName } from '@/services/embeddingClustering';
import { useEmbeddingClustering } from './useEmbeddingClustering';
import { EmbeddingClusterResults } from './EmbeddingClusterResults';

const field = 'h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white disabled:opacity-50';

/** Free, offline keyword grouping by embeddings; Ollama on this machine is optional. */
export const EmbeddingClusteringPanel: React.FC<{ projectId: string | null; keywords: string[] }> = ({ projectId, keywords }) => {
  const { t } = useTranslation();
  const { settings, result, isRunning, error, updateSettings, run } = useEmbeddingClustering(projectId, keywords);
  const usesOllama = settings.provider !== 'local';
  const threshold = settings.threshold ?? defaultEmbeddingThreshold(settings.provider);
  const tooFew = keywords.length < 2;
  const tooMany = keywords.length > MAX_EMBEDDING_KEYWORDS;

  return (
    <>
      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5" aria-labelledby="embedding-settings-title">
        <h2 id="embedding-settings-title" className="text-sm font-semibold text-slate-100">{t('embeddingClusteringUi.settingsTitle')}</h2>
        <p className="text-xs leading-5 text-slate-400">{t('embeddingClusteringUi.description')}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5 text-xs text-slate-400">{t('embeddingClusteringUi.provider')}
            <select value={settings.provider} disabled={isRunning} className={field}
              onChange={(event) => updateSettings({ provider: event.target.value as EmbeddingProviderName, threshold: null })}>
              {EMBEDDING_PROVIDERS.map((provider) => <option key={provider} value={provider}>{t(`embeddingClusteringUi.providers.${provider}`)}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">{t('embeddingClusteringUi.threshold', { value: threshold.toFixed(2) })}
            <input type="range" min={0.05} max={0.9} step={0.01} value={threshold} disabled={isRunning} className="h-9 accent-emerald-400"
              onChange={(event) => updateSettings({ threshold: Number(event.target.value) })} />
          </label>
          {usesOllama && (
            <label className="grid gap-1.5 text-xs text-slate-400">{t('embeddingClusteringUi.ollamaModel')}
              <input value={settings.ollamaModel} maxLength={120} disabled={isRunning} className={field} onChange={(event) => updateSettings({ ollamaModel: event.target.value })} />
            </label>
          )}
          <label className="grid gap-1.5 text-xs text-slate-400">{t('embeddingClusteringUi.labelModel')}
            <input value={settings.labelModel} maxLength={120} disabled={isRunning} placeholder={t('embeddingClusteringUi.labelModelPlaceholder')} className={field}
              onChange={(event) => updateSettings({ labelModel: event.target.value })} />
          </label>
        </div>
        {(usesOllama || settings.labelModel.trim()) && <p className="text-[11px] text-slate-500">{t('embeddingClusteringUi.ollamaHint')}</p>}
        {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void run()} disabled={isRunning || tooFew || tooMany || !projectId}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isRunning ? t('embeddingClusteringUi.running') : t('embeddingClusteringUi.run')}
          </button>
          <span className="text-xs text-slate-500">
            {tooMany ? t('embeddingClusteringUi.tooMany', { max: MAX_EMBEDDING_KEYWORDS }) : tooFew ? t('keywordClusteringUi.minimumKeywordsError') : t('embeddingClusteringUi.free', { count: keywords.length })}
          </span>
        </div>
      </section>
      {result && <EmbeddingClusterResults result={result} />}
    </>
  );
};
