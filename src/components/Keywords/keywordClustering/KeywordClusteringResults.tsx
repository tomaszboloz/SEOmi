import React from 'react';
import { X } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { KeywordClusteringResult } from '@/services/keywordClustering';

interface KeywordClusteringResultsProps {
  result: KeywordClusteringResult;
  t: TFunction;
}

export const KeywordClusteringResults: React.FC<KeywordClusteringResultsProps> = ({ result, t }) => {
  return (
    <section className="space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-white">{t('keywordClusteringUi.resultTitle')}</h2>
        <span className="text-xs text-slate-500">
          {t('keywordClusteringUi.resultMeta', {
            count: result.snapshots.length,
            threshold: result.minSharedUrls,
            date: new Date(result.analyzedAt).toLocaleString(),
          })}
        </span>
      </div>
      {result.clusters.length ? (
        result.clusters.map((cluster, index) => (
          <article key={cluster.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-emerald-300">
                {t('keywordClusteringUi.cluster', { index: index + 1 })}{' '}
                <span className="ml-1 text-xs font-normal text-slate-400">
                  {t('keywordClusteringUi.phraseCount', { count: cluster.keywords.length })}
                </span>
              </h3>
              <span className="text-xs text-slate-500">{t('keywordClusteringUi.overlap')}</span>
            </div>
            <ul className="space-y-3">
              {cluster.pairOverlaps.map((pair) => (
                <li
                  key={`${pair.keywordA}-${pair.keywordB}`}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-200">
                    <span>{pair.keywordA}</span>
                    <span className="text-slate-600">↔</span>
                    <span>{pair.keywordB}</span>
                    <span className="ml-auto text-xs text-emerald-300">
                      {t('keywordClusteringUi.sharedUrlCount', { count: pair.sharedUrls.length })}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {pair.sharedUrls.map((url) => (
                      <li key={url} className="truncate text-xs text-slate-500">
                        {url}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </article>
        ))
      ) : (
        <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
          {t('keywordClusteringUi.noClusters')}
        </p>
      )}
      {result.unclusteredKeywords.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-300">
            {t('keywordClusteringUi.unclustered', { count: result.unclusteredKeywords.length })}
          </h3>
          <div className="flex flex-wrap gap-2">
            {result.unclusteredKeywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-400"
              >
                <X className="h-3 w-3" />
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
