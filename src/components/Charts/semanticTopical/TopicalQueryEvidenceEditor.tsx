import type { Session } from './editor/types';
import { QueryImportControls } from './editor/QueryImportControls';
import { QueryEvidenceList } from './editor/QueryEvidenceList';

export const TopicalQueryEvidenceEditor = ({ session }: { session: Session }) => {
const { keywordResultsSource, queryImportNotice, selectedNode, t, updateManualQueries } = session;

if (!selectedNode) return null;
return (<section
                  aria-label={t("semanticWorkspace.querySectionAria")}
                  className="mt-4 rounded-lg border border-slate-800 p-3"
                >
                  <QueryImportControls session={session} />
                  <textarea
                    aria-label={t("semanticWorkspace.manualQueriesAria")}
                    className="mt-2 min-h-24 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs leading-5 text-slate-100 outline-none focus:border-emerald-400"
                    value={selectedNode.queries
                      .filter((query) => query.provenance === "asserted")
                      .map((query) => query.text)
                      .join("\n")}
                    maxLength={24000}
                    onChange={(event) =>
                      updateManualQueries(event.target.value)
                    }
                    placeholder={t(
                      "semanticWorkspace.manualQueriesPlaceholder",
                    )}
                  />
                  <p className="mt-1 text-[9px] text-slate-600">
                    {t("semanticWorkspace.queryCount", {
                      count: selectedNode.queries.length,
                    })}
                  </p>
                  {queryImportNotice && (
                    <p
                      role="status"
                      className="mt-2 rounded border border-sky-500/20 bg-sky-500/5 p-2 text-[10px] text-sky-200"
                    >
                      {queryImportNotice}
                    </p>
                  )}
                  <QueryEvidenceList session={session} />
                  {!keywordResultsSource && (
                    <p className="mt-2 text-[9px] text-slate-600">
                      {t("semanticWorkspace.noQuerySource")}
                    </p>
                  )}
                </section>);
};
