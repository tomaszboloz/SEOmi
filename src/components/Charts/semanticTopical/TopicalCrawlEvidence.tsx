

import { FactReuseToggle } from './workspacePrimitives';
import type { useSemanticTopicalSession } from './useSemanticTopicalSession';

type Session = ReturnType<typeof useSemanticTopicalSession>;
export const TopicalCrawlEvidence = ({ session }: { session: Session }) => {
const { addTopicFact, selectedNode, setTopicFactDraft, t, topicFactDraft, updateNode } = session;
if (!selectedNode) return null;
return (<div className="min-w-0">
                    <h5 className="text-xs font-semibold text-slate-300">
                      {t("semanticWorkspace.crawlSignals")}{" "}
                      <span className="font-normal text-slate-600">
                        {t("semanticWorkspace.contentEvidenceOnly")}
                      </span>
                    </h5>
                    {selectedNode.evidenceTerms.length ? (
                      <div className="mt-2 flex max-h-28 flex-wrap content-start gap-1 overflow-y-auto">
                        {selectedNode.evidenceTerms.map((term) => (
                          <span
                            key={term}
                            className="rounded border border-sky-500/15 bg-sky-500/5 px-1.5 py-1 text-[9px] text-sky-200"
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 rounded-md border border-dashed border-slate-800 p-3 text-[10px] text-slate-600">
                        {t("semanticWorkspace.noImportedTerms")}
                      </p>
                    )}
                    <h5 className="mt-4 text-xs font-semibold text-slate-300">
                      {t("semanticWorkspace.topicFacts")}{" "}
                      <span className="font-normal text-slate-600">
                        {t("semanticWorkspace.manualProvenance")}
                      </span>
                    </h5>
                    <div className="mt-2 space-y-2">
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
                    </div>
                    <div className="mt-2 grid gap-2">
                      <input
                        aria-label={t("semanticWorkspace.topicAttribute")}
                        value={topicFactDraft.attribute}
                        onChange={(event) =>
                          setTopicFactDraft((current) => ({
                            ...current,
                            attribute: event.target.value,
                          }))
                        }
                        className="h-8 rounded border border-slate-700 bg-slate-950 px-2 text-[10px] text-slate-200"
                        placeholder={t(
                          "semanticWorkspace.entityAttributePlaceholder",
                        )}
                      />
                      <input
                        aria-label={t("semanticWorkspace.topicValue")}
                        value={topicFactDraft.value}
                        onChange={(event) =>
                          setTopicFactDraft((current) => ({
                            ...current,
                            value: event.target.value,
                          }))
                        }
                        className="h-8 rounded border border-slate-700 bg-slate-950 px-2 text-[10px] text-slate-200"
                        placeholder={t(
                          "semanticWorkspace.confirmedValuePlaceholder",
                        )}
                      />
                      <input
                        aria-label={t("semanticWorkspace.topicSource")}
                        value={topicFactDraft.sourceUrl}
                        onChange={(event) =>
                          setTopicFactDraft((current) => ({
                            ...current,
                            sourceUrl: event.target.value,
                          }))
                        }
                        className="h-8 rounded border border-slate-700 bg-slate-950 px-2 text-[10px] text-slate-200"
                        placeholder={t(
                          "semanticWorkspace.sourceUrlPlaceholder",
                        )}
                      />
                      <button
                        type="button"
                        disabled={
                          !topicFactDraft.attribute.trim() ||
                          !topicFactDraft.value.trim()
                        }
                        onClick={addTopicFact}
                        className="h-8 rounded border border-slate-700 text-[10px] text-slate-300 hover:border-emerald-400 disabled:opacity-40"
                      >
                        {t("semanticWorkspace.addEntityAttribute")}
                      </button>
                    </div>
                  </div>);
};
