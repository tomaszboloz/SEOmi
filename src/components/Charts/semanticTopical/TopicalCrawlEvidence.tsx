import type { Session } from './editor/types';
import { TopicFactList } from './editor/TopicFactList';
import { TopicFactForm } from './editor/TopicFactForm';

export const TopicalCrawlEvidence = ({ session }: { session: Session }) => {
const { selectedNode, t } = session;
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
                    <TopicFactList session={session} />
                    <TopicFactForm session={session} />
                  </div>);
};
