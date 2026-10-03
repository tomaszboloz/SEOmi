import React from 'react';
import { TopicalCalendar } from '@/components/Charts/TopicalCalendar';
import { SemanticAuditPanel } from '@/components/Charts/SemanticAuditPanel';
import { SchemaGraphBuilder } from '@/components/Charts/SchemaGraphBuilder';
import { InternalLinkOpportunitiesPanel } from '@/components/Charts/InternalLinkOpportunitiesPanel';
import { EntityEvidenceGraph } from '@/components/Charts/EntityEvidenceGraph';
import type { useSemanticTopicalSession } from './useSemanticTopicalSession';
import { TopicalTopicBrowser } from './TopicalTopicBrowser';
import { TopicalNodeEditor } from './TopicalNodeEditor';

type Session = ReturnType<typeof useSemanticTopicalSession>;

export const SemanticWorkspacePanels: React.FC<{ session: Session }> = ({ session }) => {
  const {
    addNodeOnDate,
    currentRunId,
    document,
    pages,
    runs,
    selectedNode,
    setSelectedId,
    t,
    updateWorkspacePreferences,
    workspacePreferences,
  } = session;

  if (workspacePreferences.view === 'audit') {
    return (
      <SemanticAuditPanel
        document={document}
        pages={pages}
        runs={runs}
        currentRunId={currentRunId}
      />
    );
  }

  if (workspacePreferences.view === 'entity') {
    return <EntityEvidenceGraph document={document} pages={pages} />;
  }

  if (workspacePreferences.view === 'schema') {
    return (
      <SchemaGraphBuilder
        document={document}
        pages={pages}
        siteUrl={pages[0]?.url || ''}
        selectedUrl={workspacePreferences.schemaUrl}
        includeOrganization={workspacePreferences.includeSchemaOrganization}
        includeUrlBreadcrumbs={workspacePreferences.includeSchemaBreadcrumbs}
        articleType={workspacePreferences.schemaArticleType}
        onSelectedUrlChange={(schemaUrl) => updateWorkspacePreferences({ schemaUrl })}
        onIncludeOrganizationChange={(includeSchemaOrganization) =>
          updateWorkspacePreferences({ includeSchemaOrganization })
        }
        onIncludeUrlBreadcrumbsChange={(includeSchemaBreadcrumbs) =>
          updateWorkspacePreferences({ includeSchemaBreadcrumbs })
        }
        onArticleTypeChange={(schemaArticleType) =>
          updateWorkspacePreferences({ schemaArticleType })
        }
      />
    );
  }

  if (workspacePreferences.view === 'links') {
    return <InternalLinkOpportunitiesPanel pages={pages} />;
  }

  return (
    <section
      className={`grid min-h-[560px] gap-4 ${
        workspacePreferences.view === 'calendar'
          ? 'grid-cols-1'
          : 'xl:grid-cols-[minmax(260px,.78fr)_minmax(0,1.6fr)]'
      }`}
    >
      {workspacePreferences.view === 'calendar' ? (
        <TopicalCalendar
          nodes={document.nodes}
          month={workspacePreferences.month}
          filters={workspacePreferences.filters}
          search={workspacePreferences.search}
          onMonthChange={(month) => updateWorkspacePreferences({ month })}
          onFiltersChange={(filters) => updateWorkspacePreferences({ filters })}
          onSearchChange={(search) => updateWorkspacePreferences({ search })}
          onSelect={(nodeId) => {
            setSelectedId(nodeId);
            updateWorkspacePreferences({ view: 'topics' });
          }}
          onCreate={addNodeOnDate}
          onBack={() => updateWorkspacePreferences({ view: 'topics' })}
        />
      ) : (
        <TopicalTopicBrowser session={session} />
      )}

      {workspacePreferences.view === 'topics' &&
        (selectedNode ? (
          <TopicalNodeEditor session={session} />
        ) : (
          <div className="grid place-content-center rounded-xl border border-dashed border-slate-800 bg-slate-950/20 p-8 text-center">
            <p className="text-sm font-medium text-slate-300">
              {t('semanticWorkspace.selectTopic')}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {t('semanticWorkspace.selectTopicHint')}
            </p>
          </div>
        ))}
    </section>
  );
};
