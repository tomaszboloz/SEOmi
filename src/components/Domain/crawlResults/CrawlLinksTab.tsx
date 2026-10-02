

import { LoaderCircle, Code2 } from "lucide-react";

import { downloadText } from "@/services/export";
import {
  crawlLinksCsv,
  filterAndSortCrawlLinks,
  type CrawlLinkKindFilter,
  type CrawlLinkSort,
  type CrawlLinkStatusFilter,
} from "@/services/crawlLinkFilters";

import { cell, tableHead, normalizeLinkUrl } from './crawlResultsHelpers';
import { Empty, Table } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlLinksTab = ({ session }: { session: Session }) => {
const { checkExternalLinks, copiedLinkSourceKey, copyLinkSource, currentRun, externalLinkCheckError, externalLinkCheckProgress, externalLinkLimit, isCheckingExternalLinks, linkDescending, linkEvidence, linkEvidenceHref, linkKind, linkQuery, linkSort, linkStatus, navigationRunId, result, setExternalLinkLimit, setLinkDescending, setLinkKind, setLinkQuery, setLinkSort, setLinkStatus, t } = session;
{
        const allLinks = result.pages.flatMap((page) =>
          page.links.map((link, index) => ({
            sourceUrl: page.url,
            link,
            key: `${page.url}-${link.target_url}-${index}`,
          })),
        );
        const links = filterAndSortCrawlLinks(allLinks, {
          query: linkQuery,
          kind: linkKind,
          status: linkStatus,
          sort: linkSort,
          descending: linkDescending,
        });
        const internalLinks = allLinks.filter(({ link }) => link.is_internal);
        const uniqueInternalTargets = new Set(
          internalLinks.map(({ link }) => normalizeLinkUrl(link.target_url)),
        );
        const checkedInternalTargets = new Set(
          internalLinks
            .filter(({ link }) => link.target_http_status !== undefined)
            .map(({ link }) => normalizeLinkUrl(link.target_url)),
        );
        const brokenInternalTargets = new Set(
          internalLinks
            .filter(
              ({ link }) =>
                link.target_http_status !== undefined &&
                (link.target_http_status === 0 ||
                  link.target_http_status >= 400),
            )
            .map(({ link }) => normalizeLinkUrl(link.target_url)),
        );
        const uncheckedInternalCount = Math.max(
          0,
          uniqueInternalTargets.size - checkedInternalTargets.size,
        );
        const externalLinks = allLinks.filter(({ link }) => !link.is_internal);
        const uncheckedExternalCount = new Set(
          externalLinks
            .filter(({ link }) => !link.target_checked_at)
            .map(({ link }) => normalizeLinkUrl(link.target_url)),
        ).size;
        const checkedExternalCount = new Set(
          externalLinks
            .filter(
              ({ link }) =>
                link.target_checked_at &&
                !["blocked", "invalid"].includes(
                  link.target_request_error_kind || "",
                ),
            )
            .map(({ link }) => normalizeLinkUrl(link.target_url)),
        ).size;
        const blockedExternalCount = new Set(
          externalLinks
            .filter(({ link }) => link.target_request_error_kind === "blocked")
            .map(({ link }) => normalizeLinkUrl(link.target_url)),
        ).size;
        const invalidExternalCount = new Set(
          externalLinks
            .filter(({ link }) => link.target_request_error_kind === "invalid")
            .map(({ link }) => normalizeLinkUrl(link.target_url)),
        ).size;
        const externalError = externalLinkCheckError;
        return (
          <div className="space-y-3">
            <section
              className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
              aria-label={t("crawl.ui.linkFilters")}
            >
              <div className="flex flex-wrap items-end gap-2">
                <label className="grid min-w-56 flex-1 gap-1 text-[11px] text-slate-400">
                  {t("crawl.ui.searchLink")}
                  <input
                    aria-label={t("crawl.ui.searchLink")}
                    value={linkQuery}
                    onChange={(event) => setLinkQuery(event.target.value)}
                    placeholder={t("crawl.ui.searchLinkPlaceholder")}
                    className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="grid gap-1 text-[11px] text-slate-400">
                  {t("crawl.ui.type")}
                  <select
                    aria-label={t("crawl.ui.linkType")}
                    value={linkKind}
                    onChange={(event) =>
                      setLinkKind(event.target.value as CrawlLinkKindFilter)
                    }
                    className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200"
                  >
                    <option value="all">{t("crawl.ui.all")}</option>
                    <option value="internal">
                      {t("crawl.ui.internalPlural")}
                    </option>
                    <option value="external">
                      {t("crawl.ui.externalPlural")}
                    </option>
                  </select>
                </label>
                <label className="grid gap-1 text-[11px] text-slate-400">
                  {t("crawl.ui.status")}
                  <select
                    aria-label={t("crawl.ui.linkStatus")}
                    value={linkStatus}
                    onChange={(event) =>
                      setLinkStatus(event.target.value as CrawlLinkStatusFilter)
                    }
                    className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200"
                  >
                    <option value="all">{t("crawl.ui.all")}</option>
                    <option value="unchecked">
                      {t("crawl.ui.notChecked")}
                    </option>
                    <option value="ok">{t("crawl.customSearch.ok")}</option>
                    <option value="redirect">{t("crawl.ui.redirect")}</option>
                    <option value="error">{t("crawl.ui.error")}</option>
                    <option value="blocked">
                      {t("crawl.ui.blockedInvalid")}
                    </option>
                  </select>
                </label>
                <label className="grid gap-1 text-[11px] text-slate-400">
                  {t("crawl.ui.sortBy")}
                  <select
                    aria-label={t("crawl.ui.linkSort")}
                    value={linkSort}
                    onChange={(event) =>
                      setLinkSort(event.target.value as CrawlLinkSort)
                    }
                    className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200"
                  >
                    <option value="source">{t("crawl.ui.source")}</option>
                    <option value="target">{t("crawl.ui.target")}</option>
                    <option value="anchor">{t("crawl.ui.anchor")}</option>
                    <option value="status">{t("crawl.ui.status")}</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setLinkDescending((value: boolean) => !value)}
                  aria-pressed={linkDescending}
                  className="h-8 rounded-md border border-slate-700 px-2.5 text-[11px] text-slate-300 hover:bg-slate-800"
                >
                  {linkDescending
                    ? t("crawl.ui.descending")
                    : t("crawl.ui.ascending")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadText(
                      `seomi-crawl-links-${navigationRunId}.csv`,
                      crawlLinksCsv(links),
                      "text/csv",
                    )
                  }
                  disabled={!links.length}
                  className="h-8 rounded-md border border-slate-700 px-2.5 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  {t("crawl.ui.exportViewCsv")}
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                {t("crawl.ui.linksShown", {
                  visible: links.length,
                  total: allLinks.length,
                })}
              </p>
            </section>
            {internalLinks.length > 0 && (
              <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <h3 className="text-xs font-semibold text-slate-200">
                  {t("crawl.ui.internalTargetCheck")}
                </h3>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {t("crawl.ui.internalTargetSummary", {
                    unique: uniqueInternalTargets.size,
                    checked: checkedInternalTargets.size,
                    broken: brokenInternalTargets.size,
                    unchecked: uncheckedInternalCount,
                  })}
                </p>
                {uncheckedInternalCount > 0 ? (
                  <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-[10px] leading-4 text-amber-200">
                    {t("crawl.ui.uncheckedTargetNote")}
                  </p>
                ) : (
                  <p className="mt-2 text-[10px] text-emerald-300">
                    {t("crawl.ui.allInternalChecked")}
                  </p>
                )}
              </section>
            )}
            {externalLinks.length > 0 && (
              <section className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-slate-200">
                    {t("crawl.ui.externalTargetCheck")}
                  </h3>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    {t("crawl.ui.externalTargetSummary", {
                      checked: checkedExternalCount,
                      blocked: blockedExternalCount,
                      invalid: invalidExternalCount,
                      unchecked: uncheckedExternalCount,
                    })}
                  </p>
                  {isCheckingExternalLinks && externalLinkCheckProgress && (
                    <p
                      role="status"
                      className="mt-1 max-w-xl truncate text-[11px] text-emerald-300"
                    >
                      {t("crawl.ui.liveProgress", {
                        completed: externalLinkCheckProgress.completed,
                        total: externalLinkCheckProgress.total,
                      })}{" "}
                      {externalLinkCheckProgress.currentUrl ||
                        t("crawl.ui.connecting")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <label className="text-[11px] text-slate-400">
                    {t("crawl.ui.limit")}
                    <select
                      aria-label={t("crawl.ui.externalLinkLimit")}
                      value={externalLinkLimit}
                      onChange={(event) =>
                        setExternalLinkLimit(Number(event.target.value))
                      }
                      className="ml-2 h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200"
                    >
                      <option value={100}>100</option>
                      <option value={250}>250</option>
                      <option value={500}>500</option>
                      <option value={1000}>1000</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={
                      !currentRun ||
                      isCheckingExternalLinks
                    }
                    onClick={() => {
                      if (!currentRun) return;
                      if (uncheckedExternalCount) {
                        void checkExternalLinks(currentRun.id, externalLinkLimit);
                      } else {
                        void checkExternalLinks(currentRun.id, externalLinkLimit, true);
                      }
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isCheckingExternalLinks && (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    )}
                    {isCheckingExternalLinks
                      ? t("crawl.ui.checking")
                      : t("crawl.ui.checkExternalLinks")}
                  </button>
                </div>
                {externalError && (
                  <p
                    role="status"
                    className="text-xs text-amber-300 sm:basis-full"
                  >
                    {externalError}
                  </p>
                )}
              </section>
            )}
            {links.length ? (
              <Table minWidth="min-w-[900px]">
                <thead className={tableHead}>
                  <tr>
                    {[
                      t("crawl.ui.sourceUrl"),
                      t("crawl.ui.type"),
                      t("crawl.ui.targetStatus"),
                      t("crawl.ui.anchor"),
                      t("crawl.ui.target"),
                      t("crawl.ui.rel"),
                    ].map((label) => (
                      <th key={label} className={cell}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {links.map(({ sourceUrl, link, key }) => {
                    const status =
                      link.target_http_status !== undefined
                        ? t("crawl.ui.httpStatus", { status: link.target_http_status })
                        : link.target_request_error_kind === "blocked"
                          ? t("crawl.ui.blockedPrivateAddress")
                          : link.target_request_error_kind === "invalid"
                            ? t("crawl.ui.invalidAddress")
                            : link.target_request_error_kind
                              ? t("crawl.ui.requestError", {
                                  kind: link.target_request_error_kind,
                                })
                              : t("crawl.ui.notChecked");
                    const hasRequestFailure = Boolean(
                      link.target_request_error_kind &&
                      link.target_request_error_kind !== "blocked",
                    );
                    return (
                      <tr
                        key={key}
                        data-crawl-link-row
                        data-source-url={sourceUrl}
                        data-target-url={link.target_url}
                        className={`border-t border-slate-800/80 text-slate-300 ${linkEvidence?.source === sourceUrl && linkEvidence.target === link.target_url ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-400/40" : ""}`}
                      >
                        <td
                          className={`${cell} max-w-72 font-mono`}
                          title={sourceUrl}
                        >
                          <a
                            href={linkEvidenceHref(sourceUrl, link.target_url)}
                            className="block truncate text-sky-200 underline-offset-2 hover:text-sky-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                            title={t("crawl.ui.openLinkEvidence")}
                          >
                            {sourceUrl}
                          </a>
                          {link.source_excerpt ? (
                            <details className="mt-1 max-w-72 font-sans">
                              <summary className="flex cursor-pointer items-center gap-1 text-[10px] text-sky-200">
                                <Code2 className="h-3 w-3" aria-hidden="true" />
                                {t("crawl.ui.showSourceCode")}
                              </summary>
                              <div className="mt-1 rounded-md border border-slate-800 bg-slate-950/80 p-2">
                                <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-4 text-slate-400">
                                  {link.source_excerpt}
                                </pre>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void copyLinkSource(
                                      key,
                                      link.source_excerpt || "",
                                    )
                                  }
                                  className="mt-1 rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-emerald-400/50 hover:text-emerald-200"
                                >
                                  {copiedLinkSourceKey === key
                                    ? t("crawl.ui.copied")
                                    : t("crawl.ui.copyCode")}
                                </button>
                              </div>
                            </details>
                          ) : (
                            <span className="text-[10px] font-sans text-slate-600">
                              {t("crawl.ui.noExcerptOlderRun")}
                            </span>
                          )}
                        </td>
                        <td className={cell}>
                          {link.is_internal
                            ? t("crawl.ui.internal")
                            : t("crawl.ui.external")}
                        </td>
                        <td
                          className={`${cell} font-mono ${(link.target_http_status !== undefined && link.target_http_status >= 400) || hasRequestFailure ? "text-rose-300" : link.target_http_status !== undefined && link.target_http_status >= 300 ? "text-amber-300" : link.target_checked_at && link.target_request_error_kind !== "blocked" ? "text-emerald-300" : "text-slate-400"}`}
                        >
                          <span>{status}</span>
                          {link.target_redirect_url && (
                            <div
                              className="mt-1 max-w-48 truncate text-[10px] text-amber-300"
                              title={link.target_redirect_url}
                            >
                              → {link.target_redirect_url}
                            </div>
                          )}
                          {link.target_response_time_ms !== undefined && (
                            <div className="mt-1 text-[10px] text-slate-500">
                              {link.target_response_time_ms} {t("performance.milliseconds")}
                            </div>
                          )}
                        </td>
                        <td
                          className={`${cell} max-w-48 truncate`}
                          title={link.anchor_text}
                        >
                          {link.anchor_text || "—"}
                        </td>
                        <td
                          className={`${cell} max-w-64 truncate font-mono`}
                          title={link.target_url}
                        >
                          {link.target_url}
                        </td>
                        <td className={cell}>{link.rel || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <Empty>{t("crawl.ui.noLinks")}</Empty>
            )}
          </div>
        );
      }
};
