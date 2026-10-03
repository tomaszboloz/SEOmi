import React from 'react';
import type { TFunction } from 'i18next';
import type { TopicalWorkspacePreferences } from './workspaceHelpers';

interface SemanticWorkspaceNavProps {
  currentView: TopicalWorkspacePreferences['view'];
  onSelectView: (view: TopicalWorkspacePreferences['view']) => void;
  t: TFunction;
}

export const SemanticWorkspaceNav: React.FC<SemanticWorkspaceNavProps> = ({
  currentView,
  onSelectView,
  t,
}) => {
  const tabs = [
    ['topics', t('semanticWorkspace.tabTopics')],
    ['calendar', t('semanticWorkspace.tabCalendar')],
    ['audit', t('semanticWorkspace.tabAudit')],
    ['entity', t('semanticWorkspace.tabEntity')],
    ['links', t('semanticWorkspace.tabLinks')],
    ['schema', t('semanticWorkspace.tabSchema')],
  ] as const;

  return (
    <div
      role="tablist"
      aria-label={t('semanticWorkspace.viewsAria')}
      className="flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-900/45 p-2"
    >
      {tabs.map(([view, label]) => (
        <button
          key={view}
          type="button"
          role="tab"
          aria-selected={currentView === view}
          onClick={() => onSelectView(view)}
          className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
            currentView === view
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
              : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-100'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
