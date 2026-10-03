import React from 'react';
import { useTranslation } from 'react-i18next';
import { readStorage } from '@/services/storage';

export type ClusteringMethod = 'embeddings' | 'serp';
export const methodKey = (projectId: string) => `seomi_project_${projectId}_keyword_clustering_method_v1`;
// Free local embeddings are the default; a project that already has a paid
// SERP-overlap result keeps that method until the user switches.
export const loadMethod = (projectId: string | null, hasSerpResult: (projectId: string) => boolean): ClusteringMethod => {
  if (!projectId) return 'embeddings';
  const stored = readStorage(methodKey(projectId));
  if (stored === 'embeddings' || stored === 'serp') return stored;
  return hasSerpResult(projectId) ? 'serp' : 'embeddings';
};

interface ClusteringMethodSwitchProps {
  method: ClusteringMethod;
  disabled: boolean;
  onChange: (method: ClusteringMethod) => void;
}

export const ClusteringMethodSwitch: React.FC<ClusteringMethodSwitchProps> = ({ method, disabled, onChange }) => {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={t('embeddingClusteringUi.methodLabel')} className="grid gap-2 sm:grid-cols-2">
      {(['embeddings', 'serp'] as const).map((value) => (
        <button key={value} type="button" role="radio" aria-checked={method === value} disabled={disabled} onClick={() => onChange(value)}
          className={`rounded-xl border p-3 text-left text-xs transition disabled:opacity-50 ${method === value ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100' : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'}`}>
          <span className="block text-sm font-semibold">{t(`embeddingClusteringUi.methods.${value}.title`)}</span>
          <span className="mt-1 block leading-5 text-slate-400">{t(`embeddingClusteringUi.methods.${value}.description`)}</span>
        </button>
      ))}
    </div>
  );
};
