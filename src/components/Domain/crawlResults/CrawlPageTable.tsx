

import type { CrawledPageSummary } from "@/types";

import { crawlErrorLabel } from "@/services/crawlErrors";

import { localizeCrawlIssue } from "@/services/crawlIssueLocalization";

import { CrawlSort, cell, tableHead, discoverySourcesForPage } from './crawlResultsHelpers';
import { Empty, Table } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;
export const CrawlPageTable = ({ session, rows }: { session: Session; rows: CrawledPageSummary[] }) => {
const { activeProjectId, currentRun, descending, evidenceHref, evidenceUrl, result, setDescending, setSort, sort, t } = session;
return rows.length ? (
      <Table minWidth="min-w-[1040px]">
        <thead className={tableHead}>
          <tr>
            {[
              ["status", t("crawl.ui.status")],
              ["url", t("crawl.ui.url")],
              ["source", t("crawl.ui.source")],
              ["title", t("crawl.ui.title")],
              ["depth", t("crawl.ui.depth")],
              ["h1", t("uiUnits.headingLevel", { level: 1 })],
              ["words", t("crawl.ui.words")],
              ["complexity", t("crawl.ui.complexity")],
              ["readability", t("crawl.ui.readability")],
              [
                "timing",
                result.crawl_mode === "browser-rendered"
                  ? t("crawl.ui.navigation")
                  : t("crawl.ui.httpTime"),
              ],
              ["issues", t("crawl.ui.issues")],
              ["redirects", t("crawl.ui.redirects")],
            ].map(([column, label]) => {
              const key = (
                {
                  status: "status",
                  url: "url",
                  title: "title",
                  depth: "depth",
                  timing: "responseTime",
                  issues: "issues",
                } as Partial<Record<string, CrawlSort>>
              )[column];
              return (
                <th
                  key={column}
                  className={cell}
                  aria-sort={
                    key
                      ? sort === key
                        ? descending
                          ? "descending"
                          : "ascending"
                        : "none"
                      : undefined
                  }
                >
                  {key ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (sort === key) setDescending((value) => !value);
                        else {
                          setSort(key);
                          setDescending(false);
                        }
                      }}
                      className="font-semibold hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      {label}
                      {sort === key ? (descending ? " ↓" : " ↑") : ""}
                    </button>
                  ) : (
                    label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((page) => (
            <tr
              key={page.url}
              id={`crawl-row-${encodeURIComponent(page.url)}`}
              className={`border-t border-slate-800/80 text-slate-300 ${evidenceUrl === page.url ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-400/40" : ""}`}
            >
              <td className={cell}>
                <span
                  className={
                    page.request_error_kind || page.http_status >= 400
                      ? "text-rose-300"
                      : "text-emerald-300"
                  }
                  title={
                    page.request_error_kind
                      ? `${crawlErrorLabel(page.request_error_kind)} (${page.request_error_kind})`
                      : undefined
                  }
                >
                  {page.http_status ||
                    (page.request_error_kind
                      ? crawlErrorLabel(page.request_error_kind)
                      : "—")}
                </span>
                {page.request_error_kind && (
                  <span className="ml-1 font-mono text-[10px] text-rose-300/70">
                    ({page.request_error_kind})
                  </span>
                )}
              </td>
              <td
                className={`${cell} max-w-[360px] truncate font-mono`}
                title={page.url}
              >
                {activeProjectId && currentRun ? (
                  <a
                    href={evidenceHref(page.url)}
                    className="text-emerald-200 underline decoration-emerald-500/40 underline-offset-2 hover:text-white"
                    aria-label={t("crawl.ui.openEvidence", { url: page.url })}
                  >
                    {page.url}
                  </a>
                ) : (
                  page.url
                )}
              </td>
              <td className={`${cell} max-w-64`}>
                {discoverySourcesForPage(page).length ? (
                  <div className="space-y-1 text-[10px]">
                    {discoverySourcesForPage(page)
                      .slice(0, 2)
                      .map((source, index) => (
                        <div
                          key={`${source.kind}-${source.source_url || "none"}-${index}`}
                        >
                          <span className="font-medium text-sky-200">
                            {t(`mapUi.discovery.${source.kind}`)}
                          </span>
                          {source.source_url && (
                            <span
                              className="ml-1 break-all font-mono text-slate-500"
                              title={source.source_url}
                            >
                              ← {source.source_url}
                            </span>
                          )}
                          {source.anchor_text && (
                            <span
                              className="block truncate text-slate-400"
                              title={source.anchor_text}
                            >
                              „{source.anchor_text}”
                            </span>
                          )}
                        </div>
                      ))}
                    {discoverySourcesForPage(page).length > 2 && (
                      <span className="text-slate-500">
                        {t("crawl.ui.moreSources", {
                          count: discoverySourcesForPage(page).length - 2,
                        })}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-600">
                    {t("crawl.ui.notSavedRun")}
                  </span>
                )}
              </td>
              <td className={`${cell} max-w-56 truncate`} title={page.title ?? undefined}>
                {page.title || "—"}
              </td>
              <td className={`${cell} text-center font-mono`}>{page.depth}</td>
              <td className={`${cell} text-center font-mono`}>
                {page.h1_count}
              </td>
              <td
                className={`${cell} text-right font-mono`}
                title={
                  page.sentence_count == null
                    ? undefined
                    : t("crawlDeepUi.sentenceCount", { count: page.sentence_count })
                }
              >
                {page.word_count}
              </td>
              <td className={`${cell} text-right font-mono`}>
                {page.complexity_score == null
                  ? "—"
                  : `${page.complexity_score}/100`}
                {page.complexity_label ? (
                  <span className="ml-1 text-[10px] text-slate-500">
                    {page.complexity_label}
                  </span>
                ) : null}
              </td>
              <td
                className={`${cell} text-right font-mono`}
                title={
                  page.readability_grade == null
                    ? undefined
                    : `${t("crawl.ui.grade")} ${page.readability_grade.toFixed(1)}${page.readability_method ? ` · ${t("crawl.ui.formula")} ${page.readability_method}` : ""}`
                }
              >
                {page.readability_ease_score == null
                  ? "—"
                  : `${page.readability_ease_score.toFixed(0)}/100`}
                {page.readability_label ? (
                  <span className="ml-1 text-[10px] text-slate-500">
                    {page.readability_label}
                  </span>
                ) : null}
              </td>
              <td className={`${cell} text-right font-mono`}>
                {page.response_time_ms} {t("performance.milliseconds")}
              </td>
              <td className={`${cell} text-right font-mono`}>
                {page.issues.length}
              </td>
              <td className={cell}>
                <details open={evidenceUrl === page.url}>
                  <summary className="cursor-pointer text-emerald-200">
                    {evidenceUrl === page.url
                      ? t("crawl.ui.pageEvidence")
                      : t("crawl.ui.showEvidence")}
                  </summary>
                  <div className="mt-2 min-w-56 space-y-1.5 text-[11px] text-slate-400">
                    <p>
                      {t("crawl.ui.status")}:{" "}
                      <span className="font-mono text-slate-200">
                        {page.http_status ||
                          (page.request_error_kind
                            ? crawlErrorLabel(page.request_error_kind)
                            : undefined) ||
                          t("crawl.ui.noResponse")}
                      </span>{" "}
                      · {t("crawl.ui.depth")} {page.depth} ·{" "}
                      {t("crawl.ui.response")} {page.response_time_ms} {t("performance.milliseconds")}
                    </p>
                    {page.request_error_kind && (
                      <p>
                        {t("crawl.ui.transport")}:{" "}
                        <span className="text-rose-200">
                          {crawlErrorLabel(page.request_error_kind)}
                        </span>{" "}
                        <span className="font-mono text-slate-400">
                          ({page.request_error_kind})
                        </span>
                      </p>
                    )}
                    <p>
                      {t("crawl.ui.finalUrl")}:{" "}
                      <span className="break-all font-mono text-slate-300">
                        {page.final_url || page.url}
                      </span>
                    </p>
                    <p>
                      {t("crawl.ui.indexability")}:{" "}
                      {page.indexability_status || t("crawl.ui.notDetermined")}
                      {page.canonical ? ` · canonical: ${page.canonical}` : ""}
                    </p>
                    {page.indexability_verdict ? (
                      <p className="text-slate-400">
                        {t("crawl.ui.indexabilityVerdict")}: {page.indexability_verdict.status}
                        {page.indexability_verdict.reasons.length
                          ? ` · ${page.indexability_verdict.reasons.join(", ")}`
                          : ""}
                      </p>
                    ) : null}
                    {(page.sentence_count != null ||
                      page.complexity_score != null) && (
                      <p>
                        {t("crawl.ui.content")} {page.word_count}{" "}
                        {t("crawl.ui.words")}
                        {page.sentence_count != null
                          ? ` · ${page.sentence_count} ${t("crawl.ui.sentences")}`
                          : ""}
                        {page.average_words_per_sentence != null
                          ? ` · ${page.average_words_per_sentence.toFixed(1)} ${t("crawl.ui.wordsPerSentence")}`
                          : ""}
                        {page.complexity_score != null
                          ? ` · ${t("crawl.ui.complexity")} ${page.complexity_score}/100${page.complexity_label ? ` (${page.complexity_label})` : ""}`
                          : ""}
                        {page.readability_ease_score != null
                          ? ` · ${t("crawl.ui.readability")} ${page.readability_ease_score.toFixed(0)}/100${page.readability_grade != null ? ` · ${t("crawl.ui.grade")} ${page.readability_grade.toFixed(1)}` : ""}`
                          : ""}
                      </p>
                    )}
                    {page.focus_phrase && (
                      <p>
                        {t("crawl.ui.focusPhrase", {
                          phrase: page.focus_phrase.phrase,
                          body: page.focus_phrase.body_occurrences,
                          density:
                            page.focus_phrase.body_density_percent.toFixed(1),
                          title: page.focus_phrase.title_occurrences,
                          meta: page.focus_phrase.meta_description_occurrences,
                          h1: page.focus_phrase.h1_occurrences,
                        })}
                      </p>
                    )}
                    {discoverySourcesForPage(page).length > 0 && (
                      <div className="space-y-1 border-t border-slate-800 pt-1.5">
                        <p className="font-medium text-sky-200">
                          {t("crawl.ui.urlDiscovery")}
                        </p>
                        {discoverySourcesForPage(page).map((source, index) => (
                          <p
                            key={`${source.kind}-${source.source_url || "none"}-${index}`}
                            className="break-all"
                          >
                            <span className="text-sky-200">
                              {t(`crawl.discovery.${source.kind}`)}
                            </span>
                            {source.source_url ? ` · ${source.source_url}` : ""}
                            {source.anchor_text
                              ? ` · anchor: „${source.anchor_text}”`
                              : ""}
                          </p>
                        ))}
                      </div>
                    )}
                    {page.issues.length ? (
                      <ul className="list-inside list-disc space-y-1 text-amber-200">
                        {page.issues.map((issue, index) => (
                          <li key={`${issue.severity}-${index}`}>
                            <span className="font-semibold">
                              {t(`crawl.ui.severityValues.${issue.severity.toLowerCase()}`)}:
                            </span>{" "}
                            {localizeCrawlIssue(issue, t).displayMessage}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>{t("crawl.ui.noIssuesForUrl")}</p>
                    )}
                    {page.redirect_chain.length > 0 && (
                      <div className="space-y-1 border-t border-slate-800 pt-1.5">
                        {page.redirect_chain.map((hop, index) => (
                          <p
                            key={`${hop.from_url}-${index}`}
                            className="break-all"
                          >
                            <span className="font-mono text-amber-300">
                              {t("exportUi.statuses.http", { status: hop.http_status })}
                            </span>{" "}
                            · {hop.from_url} → {hop.to_url}
                            {hop.response_time_ms == null
                              ? ` · ${t("exportUi.statuses.timingUnavailable")}`
                              : ` · ${hop.response_time_ms} ${t("performance.milliseconds")}`}
                          </p>
                        ))}
                      </div>
                    )}
                    {page.redirect_stop_reason ? (
                      <p className="border-t border-slate-800 pt-1.5 text-amber-200">
                        <span className="font-medium">{t("crawl.ui.redirectStopReason")}:</span>{" "}
                        {page.redirect_stop_reason}
                      </p>
                    ) : null}
                  </div>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    ) : (
      <Empty>{t("crawl.ui.noUrlsForFilters")}</Empty>
    );
};
