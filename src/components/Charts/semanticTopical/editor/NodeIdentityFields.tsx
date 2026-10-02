import type { SearchIntent, TopicalNode } from '@/services/topicalMap';
import { inputClass, labelClass } from '../workspaceHelpers';
import type { Session } from './types';

export const NodeIdentityFields = ({ session }: { session: Session }) => {
  const { intentLabels, nodeKindLabels, selectedNode, t, updateNode } = session;
  if (!selectedNode) return null;
  return (<><label
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
                  </label></>);
};
