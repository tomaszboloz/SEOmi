import type { Session } from './types';

export const QueryEvidenceList = ({ session }: { session: Session }) => {
  const { selectedNode, sourceMetric, t } = session;
  if (!selectedNode) return null;
  return (<ul
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
                            {sourceMetric(query.source.cpc)} ·{" "}
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
                  </ul>);
};
