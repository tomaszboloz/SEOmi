import type { Session } from './types';

export const QueryImportControls = ({ session }: { session: Session }) => {
  const { gscData, gscDataFetchedAt, importQueryEvidence, isKeywordLoading, keywordResults, keywordResultsSource, t } = session;
  return (<div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h5 className="text-xs font-semibold text-slate-300">
                        {t("semanticWorkspace.queryNetwork")}{" "}
                        <span className="font-normal text-slate-600">
                          {t("semanticWorkspace.queryNetworkHint")}
                        </span>
                      </h5>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t("semanticWorkspace.queryDescription")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-label={t("semanticWorkspace.importDataForSeoAria")}
                        disabled={
                          !keywordResultsSource ||
                          !keywordResults.length ||
                          isKeywordLoading
                        }
                        onClick={() => importQueryEvidence("dataforseo")}
                        className="rounded border border-sky-500/25 px-2.5 py-1.5 text-[10px] text-sky-200 hover:bg-sky-500/10 disabled:opacity-40"
                      >
                        {t("semanticWorkspace.importDataForSeoButton", {
                          count: keywordResults.length,
                        })}
                      </button>
                      <button
                        type="button"
                        aria-label={t("semanticWorkspace.importGscAria")}
                        disabled={
                          !gscData ||
                          !gscDataFetchedAt ||
                          !gscData.queries.length
                        }
                        onClick={() => importQueryEvidence("gsc")}
                        className="rounded border border-emerald-500/25 px-2.5 py-1.5 text-[10px] text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-40"
                      >
                        {t("semanticWorkspace.sourceGsc")} · {gscData?.queries.length ?? 0}
                      </button>
                    </div>
                  </div>);
};
