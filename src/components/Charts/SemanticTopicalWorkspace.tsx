import React from 'react';
import type { Props } from './semanticTopical/contracts';
import { useSemanticTopicalSession } from './semanticTopical/useSemanticTopicalSession';
import { TopicalEntityEditor } from './semanticTopical/TopicalEntityEditor';
import { SemanticWorkspaceHeader } from './semanticTopical/SemanticWorkspaceHeader';
import { SemanticWorkspaceNav } from './semanticTopical/SemanticWorkspaceNav';
import { SemanticWorkspacePanels } from './semanticTopical/SemanticWorkspacePanels';

export const SemanticTopicalWorkspace: React.FC<Props> = (props) => {
  const session = useSemanticTopicalSession(props);
  const {
    assignedUrlCount,
    document,
    preferencesSaveError,
    saveError,
    t,
    updateWorkspacePreferences,
    workspacePreferences,
  } = session;

  if (!props.projectId) {
    return (
      <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5 text-sm text-amber-100">
        {t('semanticWorkspace.noProject')}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <SemanticWorkspaceHeader
        document={document}
        assignedUrlCount={assignedUrlCount}
        t={t}
      />

      <SemanticWorkspaceNav
        currentView={workspacePreferences.view}
        onSelectView={(view) => updateWorkspacePreferences({ view })}
        t={t}
      />

      {saveError && (
        <p
          role="alert"
          className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-200"
        >
          {t('semanticWorkspace.saveError')}
        </p>
      )}
      {preferencesSaveError && (
        <p
          role="alert"
          className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200"
        >
          {t('semanticWorkspace.preferencesSaveError')}
        </p>
      )}

      {workspacePreferences.view !== 'audit' && (
        <TopicalEntityEditor session={session} />
      )}

      <SemanticWorkspacePanels session={session} />
    </div>
  );
};
