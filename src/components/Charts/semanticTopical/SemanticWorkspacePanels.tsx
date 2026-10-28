import React, { lazy, Suspense, useEffect, useMemo } from 'react';
import { takePendingBrief } from '@/services/executionCard/openBrief';
import { TopicalCalendar } from '@/components/Charts/TopicalCalendar';
import { SemanticAuditPanel } from '@/components/Charts/SemanticAuditPanel';
import { SchemaGraphBuilder } from '@/components/Charts/SchemaGraphBuilder';
import { LinksWorkspace } from './LinksWorkspace';
import { SignalsWorkspace } from './signals/SignalsWorkspace';
import { EntityEvidenceGraph } from '@/components/Charts/EntityEvidenceGraph';
import type { useSemanticTopicalSession } from './useSemanticTopicalSession';
import { TopicalTopicBrowser } from './TopicalTopicBrowser';
import { TopicalNodeEditor } from './TopicalNodeEditor';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import { readTaxonomy } from '@/services/topicalAuthorityMonitoring/taxonomyStore';
import { buildSiteFocusReport } from '@/services/siteFocus';
import type { FocusPage } from '@/services/siteFocus';

type Session = ReturnType<typeof useSemanticTopicalSession>;
const PrePublishWorkspace = lazy(() => import('../prePublish/PrePublishWorkspace'));

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

  const authorityReport = useMemo(() => {
    const startUrl = pages[0]?.url;
    if (!startUrl) return null;
    try {
      const sfs = buildSiteFocusReport(pages as FocusPage[], startUrl);
      return buildAuthorityReport(pages as FocusPage[], startUrl, sfs, { taxonomy: readTaxonomy(session.projectId), now: sfs.generatedAt });
    } catch {
      return null;
    }
  }, [pages, session.projectId]);

  useEffect(() => {
    const pendingId = takePendingBrief();
    if (!pendingId) return;
    setSelectedId(pendingId);
    updateWorkspacePreferences({ view: 'topics' });
  }, [setSelectedId, updateWorkspacePreferences]);

  if (workspacePreferences.view === 'prepublish') return <Suspense fallback={<p role="status">{t('prePublishMountUi.loading')}</p>}>
    <PrePublishWorkspace key={session.projectId} projectId={session.projectId} runs={runs} />
  </Suspense>;
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

  if (workspacePreferences.view === 'signals') {
    return <SignalsWorkspace projectId={session.projectId} pages={pages} graph={session.graph} authorityReport={authorityReport} />;
  }

  if (workspacePreferences.view === 'links') {
    const selectedRun = runs.find((run) => run.id === currentRunId) ?? null;
    return <LinksWorkspace projectId={session.projectId} pages={selectedRun?.result.pages ?? pages} run={selectedRun} />;
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
