

import { toggleTopicalLateralRelation } from "@/services/topicalMap";

import { ContentBriefEditor } from "@/components/Charts/ContentBriefEditor";

import type { useSemanticTopicalSession } from './useSemanticTopicalSession';
import { TopicalNodeMetadata } from './TopicalNodeMetadata';
import { TopicalQueryEvidenceEditor } from './TopicalQueryEvidenceEditor';
import { TopicalUrlAssignments } from './TopicalUrlAssignments';
import { TopicalCrawlEvidence } from './TopicalCrawlEvidence';
type Session = ReturnType<typeof useSemanticTopicalSession>;
export const TopicalNodeEditor = ({ session }: { session: Session }) => {
const { document, documentRef, pages, persist, selectedFacts, selectedNode, setSelectedId, t, updateNode } = session;
if (!selectedNode) return null;
return (<article className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-emerald-300">
                      {t("semanticWorkspace.editTopic")}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {t("semanticWorkspace.autoSaved")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !window.confirm(
                          t("semanticWorkspace.confirmDeleteTopic", {
                            title: selectedNode.title,
                          }),
                        )
                      )
                        return;
                      persist({
                        ...documentRef.current,
                        nodes: documentRef.current.nodes
                          .filter((node) => node.id !== selectedNode.id)
                          .map((node) =>
                            node.parentId === selectedNode.id
                              ? { ...node, parentId: null }
                              : node,
                          ),
                      });
                      setSelectedId(null);
                    }}
                    className="rounded-md border border-rose-500/20 px-2.5 py-1.5 text-[10px] text-rose-300 hover:bg-rose-500/10"
                  >
                    {t("semanticWorkspace.removeTopic")}
                  </button>
                </div>
                <TopicalNodeMetadata session={session} />

                {document.nodes.length > 1 && (
                  <fieldset className="mt-4 rounded-lg border border-slate-800 p-3">
                    <legend className="px-1 text-[11px] font-medium text-slate-400">
                      {t("semanticWorkspace.relatedTopics")}
                    </legend>
                    <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                      {document.nodes
                        .filter((node) => node.id !== selectedNode.id)
                        .map((node) => (
                          <label
                            key={node.id}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-800 px-2 py-1.5 text-[10px] text-slate-400 hover:border-slate-600"
                          >
                            <input
                              type="checkbox"
                              checked={selectedNode.relatedNodeIds.includes(
                                node.id,
                              )}
                              onChange={() =>
                                persist(
                                  toggleTopicalLateralRelation(
                                    documentRef.current,
                                    selectedNode.id,
                                    node.id,
                                  ),
                                )
                              }
                            />
                            {node.title}
                          </label>
                        ))}
                    </div>
                  </fieldset>
                )}

                <TopicalQueryEvidenceEditor session={session} />

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <TopicalUrlAssignments session={session} />
                  <TopicalCrawlEvidence session={session} />
                </div>
                <ContentBriefEditor
                  node={selectedNode}
                  facts={selectedFacts}
                  pages={pages}
                  onUpdate={(contentBrief) =>
                    updateNode(selectedNode.id, { contentBrief })
                  }
                  onAdvance={() =>
                    updateNode(selectedNode.id, { lifecycle: "drafted" })
                  }
                />
              </article>);
};
