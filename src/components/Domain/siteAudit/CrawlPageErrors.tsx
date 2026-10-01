import React, {  } from "react";

import { ChevronDown, ChevronRight } from "lucide-react";

import { localizeCrawlIssue } from "@/services/crawlIssueLocalization";

import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlPageErrors = ({ session }: { session: Session }) => {
const { expandedRows, filteredPages, t, toggleRow } = session;

return (<tbody className="divide-y divide-slate-800/60">
                        {filteredPages.map((page) => {
                          const isExpanded = Boolean(expandedRows[page.url]);
                          return (
                            <React.Fragment key={page.url}>
                              <tr
                                onClick={() => toggleRow(page.url)}
                                className="hover:bg-slate-800/40 cursor-pointer transition"
                              >
                                <td className="px-4 py-3 text-slate-500">
                                  {page.issues.length > 0 &&
                                    (isExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    ))}
                                </td>
                                <td className="px-4 py-3 max-w-md">
                                  <div className="font-medium text-slate-200 truncate">
                                    {page.title || t("siteAudit.noTitle")}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono truncate">
                                    {page.url}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                                      page.http_status === 200
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    }`}
                                  >
                                    {page.http_status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center font-mono text-slate-400">
                                  {page.depth}
                                </td>
                                <td className="px-4 py-3 text-center font-mono text-slate-300">
                                  {page.h1_count}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-slate-400">
                                  {page.response_time_ms} {t("performance.milliseconds")}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                                      page.issues.length === 0
                                        ? "bg-emerald-500/10 text-emerald-400"
                                        : "bg-rose-500/10 text-rose-400"
                                    }`}
                                  >
                                    {t("crawl.ui.issueCount", {
                                      count: page.issues.length,
                                    })}
                                  </span>
                                </td>
                              </tr>

                              {isExpanded && page.issues.length > 0 && (
                                <tr className="bg-slate-950/80">
                                  <td
                                    colSpan={7}
                                    className="px-8 py-3 space-y-1.5"
                                  >
                                    <dl className="mb-3 grid gap-x-6 gap-y-1 rounded-md border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-400 sm:grid-cols-2">
                                      <div>
                                        <dt className="inline text-slate-500">
                                          {t("siteAudit.detailTitle")}:{" "}
                                        </dt>
                                        <dd className="inline break-all text-slate-300">
                                          {page.title || t("siteAudit.none")}
                                          {page.title_length !== undefined
                                            ? ` · ${page.title_length} ${t("siteAudit.characters")}`
                                            : ""}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="inline text-slate-500">
                                          {t("siteAudit.detailMetaDescription")}
                                          :{" "}
                                        </dt>
                                        <dd className="inline break-all text-slate-300">
                                          {page.meta_description ||
                                            t("siteAudit.none")}
                                          {page.meta_description_length !==
                                          undefined
                                            ? ` · ${page.meta_description_length} ${t("siteAudit.characters")}`
                                            : ""}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="inline text-slate-500">
                                          {t("siteAudit.detailCanonical")}:{" "}
                                        </dt>
                                        <dd className="inline break-all text-slate-300">
                                          {page.canonical ||
                                            t("siteAudit.none")}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="inline text-slate-500">
                                          {t("siteAudit.detailMetaRobots")}
                                          :{" "}
                                        </dt>
                                        <dd className="inline text-slate-300">
                                          {page.meta_robots ||
                                            t("siteAudit.noDeclaration")}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="inline text-slate-500">
                                          {t("siteAudit.xRobotsTag")}{": "}
                                        </dt>
                                        <dd className="inline text-slate-300">
                                          {page.x_robots_tag ||
                                            t("siteAudit.noDeclaration")}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="inline text-slate-500">
                                          {t("siteAudit.detailIndexability")}
                                          :{" "}
                                        </dt>
                                        <dd className="inline text-slate-300">
                                          {page.indexability_status}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="inline text-slate-500">
                                          {t("siteAudit.contentType")}{": "}
                                        </dt>
                                        <dd className="inline text-slate-300">
                                          {page.content_type ||
                                            t("siteAudit.unknown")}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="inline text-slate-500">
                                          {t("siteAudit.detailResponseBody")}
                                          :{" "}
                                        </dt>
                                        <dd className="inline text-slate-300">
                                          {page.body_truncated
                                            ? t("siteAudit.truncatedBody")
                                            : t("siteAudit.completeBody")}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="inline text-slate-500">
                                          {t("siteAudit.detailContent")}:{" "}
                                        </dt>
                                        <dd className="inline text-slate-300">
                                          {page.content_hash
                                            ? `${page.word_count} ${t("siteAudit.words")} · ${t("siteAudit.contentHash")} ${page.content_hash.slice(0, 12)}…${page.content_simhash ? ` · ${t("siteAudit.simHash")} ${page.content_simhash}` : ""}`
                                            : t("siteAudit.contentUnavailable")}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="inline text-slate-500">
                                          {t("siteAudit.detailLinks")}:{" "}
                                        </dt>
                                        <dd className="inline text-slate-300">
                                          {t("siteAudit.linkCounts", {
                                            internal: page.internal_link_count,
                                            external: page.external_link_count,
                                            checked: page.links.filter(
                                              (link) =>
                                                link.is_internal &&
                                                link.target_http_status !==
                                                  undefined,
                                            ).length,
                                          })}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="inline text-slate-500">
                                          {t("siteAudit.detailImages")}:{" "}
                                        </dt>
                                        <dd className="inline text-slate-300">
                                          {t("siteAudit.imageCounts", {
                                            total: page.images.length,
                                            lazy: page.images.filter(
                                              (image) => image.lazy_loaded,
                                            ).length,
                                          })}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="inline text-slate-500">
                                          {t("siteAudit.schema")}:{" "}
                                        </dt>
                                        <dd className="inline text-slate-300">
                                          {page.schema_types.length
                                            ? page.schema_types.join(", ")
                                            : t("siteAudit.notDetected")}
                                          {page.schema_syntax_errors
                                            ? ` · ${t("siteAudit.schemaErrors", { count: page.schema_syntax_errors })}`
                                            : ""}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="inline text-slate-500">
                                          {t("siteAudit.language")}:{" "}
                                        </dt>
                                        <dd className="inline text-slate-300">
                                          {page.document_language ||
                                            t("siteAudit.noHtmlLanguage")}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="inline text-slate-500">
                                          {t("siteAudit.hreflang")}:{" "}
                                        </dt>
                                        <dd className="inline text-slate-300">
                                          {page.hreflangs.length
                                            ? page.hreflangs
                                                .map((item) => item.language)
                                                .join(", ")
                                            : t("siteAudit.none")}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="inline text-slate-500">
                                          {t("siteAudit.amp")}:{" "}
                                        </dt>
                                        <dd className="inline break-all text-slate-300">
                                          {page.amp_url || t("siteAudit.none")}
                                        </dd>
                                      </div>
                                    </dl>
                                    {page.images.length > 0 && (
                                      <div className="mb-3 rounded-md border border-slate-800 bg-slate-900/50 p-3">
                                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                          {t("siteAudit.firstImages")}
                                        </p>
                                        {page.images
                                          .slice(0, 5)
                                          .map((image) => (
                                            <p
                                              key={image.src}
                                              className="truncate text-[11px] text-slate-400"
                                            >
                                              <span
                                                className={
                                                  image.alt === undefined
                                                    ? "text-amber-300"
                                                    : "text-slate-500"
                                                }
                                              >
                                                {image.alt === undefined
                                                  ? t("siteAudit.altMissing")
                                                  : t("siteAudit.altValue", {
                                                      value:
                                                        image.alt ||
                                                        t("siteAudit.empty"),
                                                    })}
                                              </span>{" "}
                                              · {image.src}
                                            </p>
                                          ))}
                                      </div>
                                    )}
                                    {page.links.length > 0 && (
                                      <div className="mb-3 rounded-md border border-slate-800 bg-slate-900/50 p-3">
                                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                          {t("siteAudit.firstLinks")}
                                        </p>
                                        {page.links
                                          .slice(0, 5)
                                          .map((link, index) => (
                                            <p
                                              key={`${link.target_url}-${index}`}
                                              className="truncate text-[11px] text-slate-400"
                                            >
                                              <span
                                                className={
                                                  link.target_http_status !==
                                                    undefined &&
                                                  link.target_http_status >= 400
                                                    ? "text-rose-300"
                                                    : link.target_http_status !==
                                                        undefined
                                                      ? "text-emerald-300"
                                                      : "text-slate-500"
                                                }
                                              >
                                                {link.target_http_status !==
                                                undefined
                                                  ? t("crawl.ui.httpStatus", { status: link.target_http_status })
                                                  : t(
                                                      "siteAudit.notCheckedInRun",
                                                    )}
                                              </span>{" "}
                                              ·{" "}
                                              {link.anchor_text ||
                                                t("siteAudit.noAnchor")}{" "}
                                              → {link.target_url}
                                            </p>
                                          ))}
                                      </div>
                                    )}
                                    {page.redirect_chain.length > 0 && (
                                      <div className="mb-3 rounded-md border border-slate-800 bg-slate-900/50 p-3">
                                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                          {t("siteAudit.redirectChain")}
                                        </p>
                                        {page.redirect_chain.map(
                                          (hop, index) => (
                                            <p
                                              key={`${hop.from_url}-${index}`}
                                              className="truncate text-[11px] text-slate-400"
                                            >
                                              <span className="font-mono text-amber-300">
                                                {hop.http_status}
                                              </span>{" "}
                                              · {hop.from_url} → {hop.to_url}
                                            </p>
                                          ),
                                        )}
                                      </div>
                                    )}
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                      {t("siteAudit.identifiedIssues")}
                                    </div>
                                    {page.issues.map((issue, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center space-x-2 text-xs"
                                      >
                                        <span
                                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                            issue.severity === "Critical"
                                              ? "bg-rose-500/20 text-rose-400"
                                              : "bg-amber-500/20 text-amber-400"
                                          }`}
                                        >
                                          {t(`siteAudit.severityValues.${issue.severity}`)}
                                        </span>
                                        <span className="text-slate-300">
                                          {localizeCrawlIssue(issue, t).displayMessage}
                                        </span>
                                      </div>
                                    ))}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>);
};
