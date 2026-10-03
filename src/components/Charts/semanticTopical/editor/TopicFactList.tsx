import { FactReuseToggle } from '../workspacePrimitives';
import type { Session } from './types';

export const TopicFactList = ({ session }: { session: Session }) => {
  const { selectedNode, t, updateNode } = session;
  if (!selectedNode) return null;
  return (<div className="mt-2 space-y-2">
                      {selectedNode.facts.map((fact) => (
                        <div
                          key={fact.id}
                          className="flex items-start justify-between gap-2 rounded border border-slate-800 px-2 py-1.5 text-[10px]"
                        >
                          <span className="min-w-0 break-words text-slate-400">
                            <strong className="text-slate-300">
                              {fact.attribute}:
                            </strong>{" "}
                            {fact.value}
                            {fact.sourceUrl && (
                              <a
                                href={fact.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1 text-sky-300"
                              >
                                {t("semanticWorkspace.source")}
                              </a>
                            )}
                            <FactReuseToggle
                              fact={fact}
                              onChange={(reuseStatus) =>
                                updateNode(selectedNode.id, {
                                  facts: selectedNode.facts.map((item) =>
                                    item.id === fact.id
                                      ? { ...item, reuseStatus }
                                      : item,
                                  ),
                                })
                              }
                            />
                          </span>
                          <button
                            type="button"
                            aria-label={t(
                              "semanticWorkspace.removeTopicAttribute",
                              { attribute: fact.attribute },
                            )}
                            onClick={() =>
                              updateNode(selectedNode.id, {
                                facts: selectedNode.facts.filter(
                                  (item) => item.id !== fact.id,
                                ),
                              })
                            }
                            className="shrink-0 text-slate-600 hover:text-rose-300"
                          >
                            {t("semanticWorkspace.removeTopicAttribute", {
                              attribute: fact.attribute,
                            })}
                          </button>
                        </div>
                      ))}
                    </div>);
};
