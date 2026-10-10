import React from 'react';
import { useTranslation } from 'react-i18next';
import type { EmbeddingClusteringResult } from '@/services/embeddingClustering';
import { appLocale } from '@/services/localeFormat';
import { HybridPairEvidence } from './HybridPairEvidence';

export const EmbeddingClusterResults: React.FC<{ result: EmbeddingClusteringResult }> = ({ result }) => {
  const { t } = useTranslation();
  return (
    <section className="space-y-4" aria-live="polite" aria-labelledby="embedding-result-title">
      {result.pairEvidence && <HybridPairEvidence pairs={result.pairEvidence} />}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="embedding-result-title" className="text-lg font-bold text-white">{t('embeddingClusteringUi.resultTitle')}</h2>
        <span className="text-xs text-slate-500">{t('embeddingClusteringUi.resultMeta', { model: result.model, threshold: result.threshold.toFixed(2), date: new Date(result.analyzedAt).toLocaleString(appLocale()) })}</span>
      </div>
      {result.clusters.length ? result.clusters.map((cluster, index) => (
        <article key={cluster.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-emerald-300">
              {cluster.label || t('keywordClusteringUi.cluster', { index: index + 1 })}
              <span className="ml-2 text-xs font-normal text-slate-400">{t('embeddingClusteringUi.keywordCount', { count: cluster.keywords.length })}</span>
            </h3>
            <span className={`text-xs ${cluster.cohesion >= 0.5 ? 'text-emerald-300' : 'text-amber-300'}`}>{t('embeddingClusteringUi.cohesion', { value: Math.round(cluster.cohesion * 100) })}</span>
          </div>
          <ul className="flex flex-wrap gap-2">
            {cluster.keywords.map((keyword) => <li key={keyword} className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200">{keyword}</li>)}
          </ul>
        </article>
      )) : <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">{t('keywordClusteringUi.noClusters')}</p>}
      {result.unclusteredKeywords.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-300">{t('keywordClusteringUi.unclustered', { count: result.unclusteredKeywords.length })}</h3>
          <ul className="flex flex-wrap gap-2">{result.unclusteredKeywords.map((keyword) => <li key={keyword} className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-400">{keyword}</li>)}</ul>
        </div>
      )}
    </section>
  );
};
