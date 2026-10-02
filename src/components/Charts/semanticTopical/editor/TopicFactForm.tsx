import type { Session } from './types';

export const TopicFactForm = ({ session }: { session: Session }) => {
  const { addTopicFact, selectedNode, setTopicFactDraft, t, topicFactDraft } = session;
  if (!selectedNode) return null;
  return (<div className="mt-2 grid gap-2">
                      <input
                        aria-label={t("semanticWorkspace.topicAttribute")}
                        value={topicFactDraft.attribute}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setTopicFactDraft((current) => ({ ...current, attribute: value }));
                        }}
                        className="h-8 rounded border border-slate-700 bg-slate-950 px-2 text-[10px] text-slate-200"
                        placeholder={t(
                          "semanticWorkspace.entityAttributePlaceholder",
                        )}
                      />
                      <input
                        aria-label={t("semanticWorkspace.topicValue")}
                        value={topicFactDraft.value}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setTopicFactDraft((current) => ({ ...current, value: value }));
                        }}
                        className="h-8 rounded border border-slate-700 bg-slate-950 px-2 text-[10px] text-slate-200"
                        placeholder={t(
                          "semanticWorkspace.confirmedValuePlaceholder",
                        )}
                      />
                      <input
                        aria-label={t("semanticWorkspace.topicSource")}
                        value={topicFactDraft.sourceUrl}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setTopicFactDraft((current) => ({ ...current, sourceUrl: value }));
                        }}
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
                    </div>);
};
