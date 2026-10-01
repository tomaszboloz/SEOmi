

import { inputClass } from './workspaceHelpers';

import type { useSemanticTopicalSession } from './useSemanticTopicalSession';
import { TopicalTopicList } from './TopicalTopicList';
type Session = ReturnType<typeof useSemanticTopicalSession>;
export const TopicalTopicBrowser = ({ session }: { session: Session }) => {
const { addNode, draggingNodeId, dropTopicOn, graph, hierarchyNotice, importClusters, runId, t, updateWorkspacePreferences, workspacePreferences } = session;

return (<div className="flex min-h-0 flex-col rounded-xl border border-slate-800 bg-slate-900/45 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">
                    {t("semanticWorkspace.topicMap")}
                  </h4>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {t("semanticWorkspace.topicMapDescription")}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    aria-pressed="true"
                    onClick={() =>
                      updateWorkspacePreferences({ view: "topics" })
                    }
                    className="rounded-md border border-slate-700 px-2 py-2 text-[10px] text-slate-300 aria-pressed:border-emerald-500/40 aria-pressed:text-emerald-200"
                  >
                    {t("semanticWorkspace.list")}
                  </button>
                  <button
                    type="button"
                    aria-pressed="false"
                    onClick={() =>
                      updateWorkspacePreferences({ view: "calendar" })
                    }
                    className="rounded-md border border-slate-700 px-2 py-2 text-[10px] text-slate-300 aria-pressed:border-emerald-500/40 aria-pressed:text-emerald-200"
                  >
                    {t("semanticWorkspace.calendar")}
                  </button>
                  <button
                    type="button"
                    onClick={addNode}
                    className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20"
                  >
                    ＋ {t("semanticWorkspace.topic")}
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={importClusters}
                  disabled={!graph.clusters.length}
                  className="rounded-md border border-slate-700 px-2 py-2 text-[10px] text-slate-300 hover:border-sky-400 disabled:opacity-40"
                >
                  {t("semanticWorkspace.importClusters")}
                </button>
                <span className="self-center text-[10px] text-slate-500">
                  {t("semanticWorkspace.clusterRun", {
                    count: graph.clusters.length,
                    run: runId.slice(0, 12),
                  })}
                </span>
              </div>
              <label className="mt-3">
                <span className="sr-only">
                  {t("semanticWorkspace.searchTopicsAria")}
                </span>
                <input
                  aria-label={t("semanticWorkspace.searchTopicsAria")}
                  className={inputClass}
                  value={workspacePreferences.search}
                  onChange={(event) =>
                    updateWorkspacePreferences({ search: event.target.value })
                  }
                  placeholder={t("semanticWorkspace.searchTopicsPlaceholder")}
                />
              </label>
              <div
                aria-label={t("semanticWorkspace.dropRootAria")}
                onDragOver={(event) => {
                  if (draggingNodeId) event.preventDefault();
                }}
                onDrop={dropTopicOn(null)}
                className={`mt-2 rounded-md border border-dashed px-2.5 py-2 text-[10px] transition-colors ${draggingNodeId ? "border-emerald-400/50 bg-emerald-500/5 text-emerald-200" : "border-slate-800 text-slate-600"}`}
              >
                {t("semanticWorkspace.dropRootHint")}
              </div>
              {hierarchyNotice && (
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-2 rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-2 text-[10px] text-slate-300"
                >
                  {hierarchyNotice}
                </p>
              )}
              <TopicalTopicList session={session} />
              <p className="mt-2 border-t border-slate-800 pt-2 text-[9px] leading-4 text-slate-600">
                {t("semanticWorkspace.mappingNote")}
              </p>
            </div>);
};
