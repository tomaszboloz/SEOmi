import type { TopicalNode } from '@/services/topicalMap';
import { inputClass, labelClass } from '../workspaceHelpers';
import type { Session } from './types';

export const NodeLifecycleFields = ({ session }: { session: Session }) => {
  const { document, lifecycleLabels, moveTopicalNode, selectedBriefAssessment, selectedNode, t, updateNode } = session;
  if (!selectedNode) return null;
  return (<><label className={labelClass}>
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
                  </label></>);
};
