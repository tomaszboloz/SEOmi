

import { normalizeTopicalCandidateUrl, inputClass } from './workspaceHelpers';

import type { useSemanticTopicalSession } from './useSemanticTopicalSession';

type Session = ReturnType<typeof useSemanticTopicalSession>;
export const TopicalUrlAssignments = ({ session }: { session: Session }) => {
const { availableUrlCandidates, crawledUrls, matchingUrlCandidates, pageSearch, selectedNode, setPageSearch, t, updateNode } = session;
if (!selectedNode) return null;
return (<div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h5 className="text-xs font-semibold text-slate-300">
                        {t("semanticWorkspace.plannedUrls")}
                      </h5>
                      <span className="text-[9px] text-slate-600">
                        {t("semanticWorkspace.currentRunCount", {
                          count: selectedNode.sourceUrls.filter((url) =>
                            crawledUrls.has(
                              normalizeTopicalCandidateUrl(url) || "",
                            ),
                          ).length,
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-[9px] leading-4 text-slate-600">
                      {t("semanticWorkspace.plannedUrlsDescription")}
                    </p>
                    <label className="mt-2 block">
                      <span className="sr-only">
                        {t("semanticWorkspace.searchUrlAria")}
                      </span>
                      <input
                        aria-label={t("semanticWorkspace.searchUrlAria")}
                        value={pageSearch}
                        onChange={(event) => setPageSearch(event.target.value)}
                        className={inputClass}
                        placeholder={t(
                          "semanticWorkspace.searchUrlPlaceholder",
                        )}
                      />
                    </label>
                    <ul className="mt-2 max-h-48 divide-y divide-slate-800 overflow-y-auto rounded-md border border-slate-800">
                      {availableUrlCandidates.map((candidate) => {
                        const { url } = candidate;
                        const checked = selectedNode.sourceUrls.some(
                          (item) => normalizeTopicalCandidateUrl(item) === url,
                        );
                        const sourceLabel =
                          candidate.source === "crawl"
                            ? t("semanticWorkspace.sourceCrawl")
                            : candidate.source === "content-link"
                              ? t("semanticWorkspace.sourceContentLink")
                              : candidate.source === "sitemap"
                                ? t("semanticWorkspace.sourceSitemap")
                                : t("semanticWorkspace.sourceSaved");
                        let path = url;
                        try {
                          path =
                            new URL(url).pathname + new URL(url).search || "/";
                        } catch {
                          /* URL was validated while candidates were built. */
                        }
                        const candidateLabel =
                          candidate.source === "content-link" && candidate.title
                            ? t("semanticWorkspace.linkText", {
                                title: candidate.title,
                              })
                            : candidate.title || url;
                        return (
                          <li key={url}>
                            <label className="flex cursor-pointer items-center gap-2 px-2 py-2 text-[10px] hover:bg-slate-950/60">
                              <input
                                type="checkbox"
                                aria-label={t("semanticWorkspace.assignUrlToTopic", {
                                  url,
                                  topic: selectedNode.title,
                                })}
                                checked={checked}
                                onChange={() => {
                                  const sourceUrls = checked
                                    ? selectedNode.sourceUrls.filter(
                                        (item) =>
                                          normalizeTopicalCandidateUrl(item) !==
                                          url,
                                      )
                                    : [...selectedNode.sourceUrls, url].slice(
                                        0,
                                        1000,
                                      );
                                  updateNode(selectedNode.id, { sourceUrls });
                                }}
                              />
                              <span className="min-w-0">
                                <span className="block truncate font-mono text-slate-300">
                                  {path || "/"}
                                </span>
                                <span className="block truncate text-slate-600">
                                  {candidateLabel}
                                </span>
                                <span
                                  className={`block truncate ${candidate.source === "crawl" ? "text-emerald-400" : "text-amber-400"}`}
                                >
                                  {sourceLabel}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                      {availableUrlCandidates.length === 0 && (
                        <li className="p-3 text-[10px] text-slate-600">
                          {t("semanticWorkspace.noUrlCandidates")}
                        </li>
                      )}
                    </ul>
                    {matchingUrlCandidates.length > 100 && (
                      <p className="mt-1 text-[9px] text-slate-600">
                        {t("semanticWorkspace.urlCandidatesLimited", {
                          count: matchingUrlCandidates.length,
                        })}
                      </p>
                    )}
                  </div>);
};
