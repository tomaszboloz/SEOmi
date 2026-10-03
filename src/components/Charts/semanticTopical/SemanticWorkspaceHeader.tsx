import React from 'react';
import type { TFunction } from 'i18next';
import type { TopicalMapDocument } from '@/services/topicalMap';
import { Metric } from './workspacePrimitives';

interface SemanticWorkspaceHeaderProps {
  document: TopicalMapDocument;
  assignedUrlCount: number;
  t: TFunction;
}

export const SemanticWorkspaceHeader: React.FC<SemanticWorkspaceHeaderProps> = ({
  document,
  assignedUrlCount,
  t,
}) => {
  return (
    <header className="flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-[linear-gradient(112deg,rgba(16,185,129,.09),rgba(15,23,42,.15)_42%,rgba(59,130,246,.05))] p-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-300">
          {t('semanticWorkspace.headerEyebrow', {
            count: document.nodes.length,
          })}
        </p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-100">
          {t('semanticWorkspace.title')}
        </h3>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
          {t('semanticWorkspace.description')}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric
          label={t('semanticWorkspace.metricCore')}
          value={document.nodes.filter((node) => node.boundary === 'core').length}
        />
        <Metric
          label={t('semanticWorkspace.metricOuter')}
          value={document.nodes.filter((node) => node.boundary === 'outer').length}
        />
        <Metric
          label={t('semanticWorkspace.metricAssignedUrls')}
          value={assignedUrlCount}
        />
      </div>
    </header>
  );
};
