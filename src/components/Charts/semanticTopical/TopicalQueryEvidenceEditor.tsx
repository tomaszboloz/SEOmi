

import type { useSemanticTopicalSession } from './useSemanticTopicalSession';

type Session = ReturnType<typeof useSemanticTopicalSession>;
export const TopicalQueryEvidenceEditor = ({ session }: { session: Session }) => {
const { gscData, gscDataFetchedAt, importQueryEvidence, isKeywordLoading, keywordResults, keywordResultsSource, queryImportNotice, selectedNode, sourceMetric, t, updateManualQueries } = session;

if (!selectedNode) return null;
return (<section
                  aria-label={t("semanticWorkspace.querySectionAria")}
                  className="mt-4 rounded-lg border border-slate-800 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
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
                  </div>
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
                  <ul
                    aria-label={t("semanticWorkspace.queryOriginAria")}
                    className="mt-2 max-h-56 space-y-1 overflow-y-auto"
                  >
                    {selectedNode.queries.map((query) => (
                      <li
                        key={query.id}
                        className="rounded border border-slate-800/80 px-2 py-1.5 text-[10px]"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <span className="font-medium text-slate-200">
                            {query.text}
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 ${query.provenance === "dataforseo" ? "border-sky-500/20 text-sky-300" : query.provenance === "gsc" ? "border-emerald-500/20 text-emerald-300" : "border-slate-700 text-slate-500"}`}
                          >
                            {query.provenance === "dataforseo"
                              ? t("semanticWorkspace.sourceDataForSeo")
                              : query.provenance === "gsc"
                                ? t("semanticWorkspace.sourceGsc")
                                : t("semanticWorkspace.asserted")}
                          </span>
                        </div>
                        {query.source?.provider ===
                          "DataForSEO Google Ads Keywords for Keywords Live" && (
                          <p className="mt-1 break-words text-slate-500">
                            {query.source.countryCode} ·{" "}
                            {t("semanticWorkspace.location")}{" "}
                            {query.source.locationCode} ·{" "}
                            {query.source.languageCode} ·{" "}
                            {t("semanticWorkspace.retrieved")}{" "}
                            {query.source.retrievedAt} ·{" "}
                            {t("semanticWorkspace.seed")}{" "}
                            {query.source.seedKeyword}
                            <br />
                            {t("semanticWorkspace.searchVolume")}:{" "}
                            {sourceMetric(query.source.searchVolume)} · {t("semanticWorkspace.cpc")}:{" "}
                            {t("semanticWorkspace.cpc")}: {sourceMetric(query.source.cpc)} ·{" "}
                            {t("semanticWorkspace.competitionIndex")}:{" "}
                            {sourceMetric(query.source.competitionIndex)} ·{" "}
                            {t("semanticWorkspace.providerIntent")}:{" "}
                            {query.source.searchIntent ||
                              t("semanticWorkspace.noValue")}{" "}
                            · {t("semanticWorkspace.monthlyObservations")}:{" "}
                            {query.source.monthlySearches.length}
                          </p>
                        )}
                        {query.source?.provider === "Google Search Console" && (
                          <p className="mt-1 break-words text-slate-500">
                            {query.source.propertyUrl} ·{" "}
                            {query.source.startDate}–{query.source.endDate} ·{" "}
                            {t("semanticWorkspace.retrieved")}{" "}
                            {query.source.retrievedAt}
                            <br />
                            {t("semanticWorkspace.clicks")}:{" "}
                            {query.source.clicks} ·{" "}
                            {t("semanticWorkspace.impressions")}:{" "}
                            {query.source.impressions} · {t("searchConsole.ctr")}:{" "}
                            {(query.source.ctr * 100).toFixed(2)}% ·{" "}
                            {t("semanticWorkspace.averagePosition")}:{" "}
                            {query.source.position.toFixed(1)}
                            {query.source.queryRowsMayBeTruncated
                              ? ` · ${t("semanticWorkspace.truncatedRows", { count: query.source.maxRowsPerDimension })}`
                              : ""}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                  {!keywordResultsSource && (
                    <p className="mt-2 text-[9px] text-slate-600">
                      {t("semanticWorkspace.noQuerySource")}
                    </p>
                  )}
                </section>);
};
