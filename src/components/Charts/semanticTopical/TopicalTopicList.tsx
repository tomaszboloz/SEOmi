

import { normalizeTopicalCandidateUrl, topicalNodeDepth } from './workspaceHelpers';

import type { useSemanticTopicalSession } from './useSemanticTopicalSession';

type Session = ReturnType<typeof useSemanticTopicalSession>;
export const TopicalTopicList = ({ session }: { session: Session }) => {
const { crawledUrls, document, draggingNodeId, dropTopicOn, lifecycleLabels, matchingTopics, nodeKindLabels, selectedId, setDraggingNodeId, setHierarchyNotice, setSelectedId, t } = session;

return (<ul className="mt-3 min-h-48 flex-1 space-y-1 overflow-y-auto pr-1">
                {matchingTopics.map((node) => {
                  const pageCount = node.sourceUrls.filter((url) =>
                    crawledUrls.has(normalizeTopicalCandidateUrl(url) || ""),
                  ).length;
                  const parentTitle = node.parentId
                    ? document.nodes.find(
                        (candidate) => candidate.id === node.parentId,
                      )?.title
                    : null;
                  const depth = topicalNodeDepth(node, document.nodes);
                  return (
                    <li
                      key={node.id}
                      style={{ marginLeft: `${Math.min(depth, 5) * 12}px` }}
                    >
                      <button
                        type="button"
                        draggable
                        aria-label={t("semanticWorkspace.topicAria", {
                          title: node.title,
                        })}
                        aria-pressed={selectedId === node.id}
                        onClick={() => setSelectedId(node.id)}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", node.id);
                          setDraggingNodeId(node.id);
                          setHierarchyNotice(
                            t("semanticWorkspace.dropTopicNotice"),
                          );
                        }}
                        onDragEnd={() => setDraggingNodeId(null)}
                        onDragOver={(event) => {
                          if (draggingNodeId && draggingNodeId !== node.id)
                            event.preventDefault();
                        }}
                        onDrop={dropTopicOn(node.id)}
                        className={`w-full rounded-lg border p-2.5 text-left transition-colors ${selectedId === node.id ? "border-emerald-500/40 bg-emerald-500/10" : draggingNodeId === node.id ? "border-sky-500/40 opacity-60" : "border-transparent hover:border-slate-700 hover:bg-slate-950/60"}`}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0 truncate text-xs font-medium text-slate-200">
                            {node.title}
                          </span>
                          <span className="shrink-0 text-[9px] text-slate-500">
                            {nodeKindLabels[node.kind]}
                          </span>
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1.5 text-[9px] text-slate-500">
                          <span>
                            {node.boundary === "core"
                              ? t("semanticWorkspace.core")
                              : t("semanticWorkspace.outer")}
                          </span>
                          <span>·</span>
                          <span>{lifecycleLabels[node.lifecycle]}</span>
                          {node.sourceRunId && (
                            <>
                              <span>·</span>
                              <span>
                                {t("semanticWorkspace.urlCount", {
                                  count: pageCount,
                                })}
                              </span>
                            </>
                          )}
                          {parentTitle && (
                            <>
                              <span>·</span>
                              <span>
                                {t("semanticWorkspace.parent", {
                                  title: parentTitle,
                                })}
                              </span>
                            </>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {matchingTopics.length === 0 && (
                  <li className="rounded-lg border border-dashed border-slate-800 p-5 text-center">
                    <p className="text-xs text-slate-400">
                      {document.nodes.length
                        ? t("semanticWorkspace.noTopicMatches")
                        : t("semanticWorkspace.emptyMap")}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      {t("semanticWorkspace.emptyMapHint")}
                    </p>
                  </li>
                )}
              </ul>);
};
