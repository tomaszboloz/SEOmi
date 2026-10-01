

import { TopicalCalendar } from "@/components/Charts/TopicalCalendar";

import { SemanticAuditPanel } from "@/components/Charts/SemanticAuditPanel";
import { SchemaGraphBuilder } from "@/components/Charts/SchemaGraphBuilder";

import { InternalLinkOpportunitiesPanel } from "@/components/Charts/InternalLinkOpportunitiesPanel";
import { EntityEvidenceGraph } from "@/components/Charts/EntityEvidenceGraph";

import type { Props } from './semanticTopical/contracts';
import { useSemanticTopicalSession } from './semanticTopical/useSemanticTopicalSession';
import { TopicalEntityEditor } from './semanticTopical/TopicalEntityEditor';
import { TopicalTopicBrowser } from './semanticTopical/TopicalTopicBrowser';
import { TopicalNodeEditor } from './semanticTopical/TopicalNodeEditor';
import { Metric } from './semanticTopical/workspacePrimitives';
export const SemanticTopicalWorkspace = (props: Props) => {
const session = useSemanticTopicalSession(props);
const { addNodeOnDate, assignedUrlCount, currentRunId, document, pages, preferencesSaveError, runs, saveError, selectedNode, setSelectedId, t, updateWorkspacePreferences, workspacePreferences } = session;
if (!props.projectId)
    return (
      <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5 text-sm text-amber-100">
        {t("semanticWorkspace.noProject")}
      </section>
    );
return (<div className="space-y-4">
      <header className="flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-[linear-gradient(112deg,rgba(16,185,129,.09),rgba(15,23,42,.15)_42%,rgba(59,130,246,.05))] p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-300">
            {t("semanticWorkspace.headerEyebrow", {
              count: document.nodes.length,
            })}
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-100">
            {t("semanticWorkspace.title")}
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            {t("semanticWorkspace.description")}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric
            label={t("semanticWorkspace.metricCore")}
            value={
              document.nodes.filter((node) => node.boundary === "core").length
            }
          />
          <Metric
            label={t("semanticWorkspace.metricOuter")}
            value={
              document.nodes.filter((node) => node.boundary === "outer").length
            }
          />
          <Metric
            label={t("semanticWorkspace.metricAssignedUrls")}
            value={assignedUrlCount}
          />
        </div>
      </header>

      <div
        role="tablist"
        aria-label={t("semanticWorkspace.viewsAria")}
        className="flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-900/45 p-2"
      >
        {(
          [
            ["topics", t("semanticWorkspace.tabTopics")],
            ["calendar", t("semanticWorkspace.tabCalendar")],
            ["audit", t("semanticWorkspace.tabAudit")],
            ["entity", t("semanticWorkspace.tabEntity")],
            ["links", t("semanticWorkspace.tabLinks")],
            ["schema", t("semanticWorkspace.tabSchema")],
          ] as const
        ).map(([view, label]) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={workspacePreferences.view === view}
            onClick={() => updateWorkspacePreferences({ view })}
            className={`rounded-lg border px-3 py-2 text-xs transition-colors ${workspacePreferences.view === view ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-100" : "border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-100"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {saveError && (
        <p
          role="alert"
          className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-200"
        >
          {t("semanticWorkspace.saveError")}
        </p>
      )}
      {preferencesSaveError && (
        <p
          role="alert"
          className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200"
        >
          {t("semanticWorkspace.preferencesSaveError")}
        </p>
      )}

      {workspacePreferences.view !== "audit" && (
        <>
          <TopicalEntityEditor session={session} />
        </>
      )}

      {workspacePreferences.view === "audit" ? (
        <SemanticAuditPanel
          document={document}
          pages={pages}
          runs={runs}
          currentRunId={currentRunId}
        />
      ) : workspacePreferences.view === "entity" ? (
        <EntityEvidenceGraph document={document} pages={pages} />
      ) : workspacePreferences.view === "schema" ? (
        <SchemaGraphBuilder
          document={document}
          pages={pages}
          siteUrl={pages[0]?.url || ""}
          selectedUrl={workspacePreferences.schemaUrl}
          includeOrganization={workspacePreferences.includeSchemaOrganization}
          includeUrlBreadcrumbs={workspacePreferences.includeSchemaBreadcrumbs}
          articleType={workspacePreferences.schemaArticleType}
          onSelectedUrlChange={(schemaUrl) =>
            updateWorkspacePreferences({ schemaUrl })
          }
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
      ) : workspacePreferences.view === "links" ? (
        <InternalLinkOpportunitiesPanel pages={pages} />
      ) : (
        <section
          className={`grid min-h-[560px] gap-4 ${workspacePreferences.view === "calendar" ? "grid-cols-1" : "xl:grid-cols-[minmax(260px,.78fr)_minmax(0,1.6fr)]"}`}
        >
          {workspacePreferences.view === "calendar" ? (
            <TopicalCalendar
              nodes={document.nodes}
              month={workspacePreferences.month}
              filters={workspacePreferences.filters}
              search={workspacePreferences.search}
              onMonthChange={(month) => updateWorkspacePreferences({ month })}
              onFiltersChange={(filters) =>
                updateWorkspacePreferences({ filters })
              }
              onSearchChange={(search) =>
                updateWorkspacePreferences({ search })
              }
              onSelect={(nodeId) => {
                setSelectedId(nodeId);
                updateWorkspacePreferences({ view: "topics" });
              }}
              onCreate={addNodeOnDate}
              onBack={() => updateWorkspacePreferences({ view: "topics" })}
            />
          ) : (
            <TopicalTopicBrowser session={session} />
          )}

          {workspacePreferences.view === "topics" &&
            (selectedNode ? (
              <TopicalNodeEditor session={session} />
            ) : (
              <div className="grid place-content-center rounded-xl border border-dashed border-slate-800 bg-slate-950/20 p-8 text-center">
                <p className="text-sm font-medium text-slate-300">
                  {t("semanticWorkspace.selectTopic")}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {t("semanticWorkspace.selectTopicHint")}
                </p>
              </div>
            ))}
        </section>
      )}
    </div>);
};
