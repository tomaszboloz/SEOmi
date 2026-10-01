

import { type SearchIntent, type TopicalNode } from "@/services/topicalMap";

import { inputClass, labelClass } from './workspaceHelpers';

import type { useSemanticTopicalSession } from './useSemanticTopicalSession';

type Session = ReturnType<typeof useSemanticTopicalSession>;
export const TopicalNodeMetadata = ({ session }: { session: Session }) => {
const { document, intentLabels, lifecycleLabels, moveTopicalNode, nodeKindLabels, selectedBriefAssessment, selectedNode, t, updateNode } = session;
if (!selectedNode) return null;
return (<div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <label
                    className={`${labelClass} md:col-span-2 xl:col-span-1`}
                  >
                    {t("semanticWorkspace.name")}
                    <input
                      className={inputClass}
                      value={selectedNode.title}
                      maxLength={180}
                      onChange={(event) =>
                        updateNode(selectedNode.id, {
                          title: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    {t("semanticWorkspace.type")}
                    <select
                      className={inputClass}
                      value={selectedNode.kind}
                      onChange={(event) =>
                        updateNode(selectedNode.id, {
                          kind: event.target.value as TopicalNode["kind"],
                        })
                      }
                    >
                      {Object.entries(nodeKindLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    {t("semanticWorkspace.scope")}
                    <select
                      className={inputClass}
                      value={selectedNode.boundary}
                      onChange={(event) =>
                        updateNode(selectedNode.id, {
                          boundary: event.target
                            .value as TopicalNode["boundary"],
                        })
                      }
                    >
                      <option value="core">
                        {t("semanticWorkspace.coreOption")}
                      </option>
                      <option value="outer">
                        {t("semanticWorkspace.outerOption")}
                      </option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    {t("semanticWorkspace.intentLabel")}
                    <select
                      className={inputClass}
                      value={selectedNode.intent}
                      onChange={(event) =>
                        updateNode(selectedNode.id, {
                          intent: event.target.value as SearchIntent,
                        })
                      }
                    >
                      {Object.entries(intentLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    {t("semanticWorkspace.lifecycleLabel")}
                    <select
                      className={inputClass}
                      value={selectedNode.lifecycle}
                      onChange={(event) => {
                        const next = event.target
                          .value as TopicalNode["lifecycle"];
                        if (
                          next === "briefed" &&
                          !selectedBriefAssessment?.readyForBrief
                        )
                          return;
                        if (
                          next === "drafted" &&
                          !selectedBriefAssessment?.readyToAdvance
                        )
                          return;
                        updateNode(selectedNode.id, { lifecycle: next });
                      }}
                    >
                      {Object.entries(lifecycleLabels).map(([value, label]) => (
                        <option
                          key={value}
                          value={value}
                          disabled={
                            (value === "briefed" &&
                              !selectedBriefAssessment?.readyForBrief) ||
                            (value === "drafted" &&
                              !selectedBriefAssessment?.readyToAdvance)
                          }
                        >
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    {t("semanticWorkspace.publishDate")}
                    <input
                      type="date"
                      className={inputClass}
                      value={selectedNode.scheduledDate}
                      onChange={(event) =>
                        updateNode(selectedNode.id, {
                          scheduledDate: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    {t("semanticWorkspace.parentTopic")}
                    <select
                      className={inputClass}
                      value={selectedNode.parentId ?? ""}
                      onChange={(event) =>
                        moveTopicalNode(
                          selectedNode.id,
                          event.target.value || null,
                        )
                      }
                    >
                      <option value="">
                        {t("semanticWorkspace.noParent")}
                      </option>
                      {document.nodes
                        .filter((node) => node.id !== selectedNode.id)
                        .map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.title}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>);
};
