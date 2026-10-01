

import { FileDown, Image, LoaderCircle } from "lucide-react";
import { format } from "date-fns";

import { cell, tableHead, downloadRenderedArtifact, formatNumber } from './crawlResultsHelpers';
import { Table } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlPerformanceTab = ({ session }: { session: Session }) => {
const { createRenderedArtifact, renderedArtifact, renderedArtifactError, renderedArtifactKind, renderedArtifactUrl, renderedArtifactUrls, result, setRenderedArtifactUrl, t } = session;
{
        const timings = result.pages
          .map((page) => page.response_time_ms)
          .filter((value) => Number.isFinite(value) && value >= 0)
          .sort((a, b) => a - b);
        const buckets = [
          {
            label: t("crawlDeepUi.timingUnder100"),
            count: timings.filter((value) => value < 100).length,
          },
          {
            label: t("crawlDeepUi.timing100To299"),
            count: timings.filter((value) => value >= 100 && value < 300)
              .length,
          },
          {
            label: t("crawlDeepUi.timing300To999"),
            count: timings.filter((value) => value >= 300 && value < 1000)
              .length,
          },
          {
            label: t("crawlDeepUi.timingOver1000"),
            count: timings.filter((value) => value >= 1000).length,
          },
        ];
        const median =
          timings.length === 0
            ? undefined
            : timings.length % 2 === 1
              ? timings[(timings.length - 1) / 2]
              : (timings[timings.length / 2 - 1] +
                  timings[timings.length / 2]) /
                2;
        const renderedVitalsPages = result.pages.filter(
          (page) =>
            page.rendered_lcp_ms !== undefined ||
            page.rendered_inp_ms !== undefined ||
            page.rendered_cls !== undefined,
        );
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label:
                    result.crawl_mode === "browser-rendered"
                      ? t("crawlDeepUi.fastestNavigation")
                      : t("crawlDeepUi.fastestResponse"),
                  value: timings.length ? `${timings[0]} ms` : "—",
                },
                {
                  label: t("crawlDeepUi.median"),
                  value: median === undefined ? "—" : `${median} ms`,
                },
                {
                  label:
                    result.crawl_mode === "browser-rendered"
                      ? t("crawlDeepUi.slowestNavigation")
                      : t("crawlDeepUi.slowestResponse"),
                  value: timings.length ? `${timings.at(-1)} ms` : "—",
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                >
                  <p className="text-xs text-slate-500">{metric.label}</p>
                  <p className="mt-1 font-mono text-xl font-semibold text-white">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
            <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {result.crawl_mode === "browser-rendered"
                  ? t("crawlDeepUi.navigationRenderTime")
                  : t("crawlDeepUi.httpResponseTime")}
              </h3>
              <div className="space-y-3">
                {buckets.map((bucket) => (
                  <div
                    key={bucket.label}
                    className="grid grid-cols-[90px_1fr_56px] items-center gap-3 text-xs"
                  >
                    <span className="font-mono text-slate-400">
                      {bucket.label}
                    </span>
                    <div className="h-2 overflow-hidden rounded bg-slate-800">
                      <div
                        className="h-full rounded bg-emerald-400"
                        style={{
                          width: `${timings.length ? (bucket.count / timings.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-right font-mono text-slate-300">
                      {bucket.count}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                {result.crawl_mode === "browser-rendered"
                  ? t("crawlDeepUi.navigationTimingNote")
                  : t("crawlDeepUi.httpTimingNote")}
              </p>
            </section>
            {result.crawl_mode === "browser-rendered" && (
              <section className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-4">
                <div className="mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-200">
                    {t("crawlDeepUi.renderedVitals")}
                  </h3>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400">
                    {t("crawlDeepUi.renderedVitalsDescription")}
                  </p>
                </div>
                {renderedVitalsPages.length ? (
                  <Table minWidth="min-w-[760px]">
                    <thead className={tableHead}>
                      <tr>
                        {[t("crawl.ui.url"), t("crawlDeepUi.lcp"), t("crawlDeepUi.inp"), t("crawlDeepUi.cls")].map((label) => (
                          <th key={label} className={cell}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {renderedVitalsPages.map((page) => (
                        <tr
                          key={page.url}
                          className="border-t border-slate-800/80 text-slate-300"
                        >
                          <td
                            className={`${cell} max-w-[420px] truncate font-mono`}
                            title={page.url}
                          >
                            {page.url}
                          </td>
                          <td className={`${cell} font-mono`}>
                            {page.rendered_lcp_ms == null
                              ? t("crawlDeepUi.noEntry")
                              : `${page.rendered_lcp_ms} ms`}
                          </td>
                          <td className={`${cell} font-mono`}>
                            {page.rendered_inp_ms == null
                              ? t("crawlDeepUi.noInteraction")
                              : `${page.rendered_inp_ms} ms`}
                          </td>
                          <td className={`${cell} font-mono`}>
                            {page.rendered_cls == null
                              ? t("crawlDeepUi.noEntry")
                              : page.rendered_cls.toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <p className="text-xs text-slate-400">
                    {t("crawlDeepUi.noVitals")}
                  </p>
                )}
              </section>
            )}
            {result.crawl_mode === "browser-rendered" && (
              <section
                aria-label={t("crawl.ui.renderedArtifacts")}
                className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-4"
              >
                <div className="mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-200">
                    {t("crawlDeepUi.screenshotAndPdf")}
                  </h3>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400">
                    {t("crawlDeepUi.artifactDescription")}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="min-w-0 flex-1 text-[11px] text-slate-400">
                    {t("crawlDeepUi.artifactUrl")}
                    <select
                      aria-label={t("crawl.ui.renderedUrlForArtifact")}
                      value={renderedArtifactUrl}
                      onChange={(event) =>
                        setRenderedArtifactUrl(event.target.value)
                      }
                      className="mt-1 block h-9 w-full min-w-0 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-sky-400"
                    >
                      {renderedArtifactUrls.map((url) => (
                        <option key={url} value={url}>
                          {url}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={renderedArtifactKind !== null}
                      onClick={() => void createRenderedArtifact("screenshot")}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-400/10 px-3 text-xs font-medium text-sky-100 transition hover:border-sky-300/80 hover:bg-sky-400/20 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      {renderedArtifactKind === "screenshot" ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Image className="h-3.5 w-3.5" />
                      )}
                      {t("crawlDeepUi.screenshot")}
                    </button>
                    <button
                      type="button"
                      disabled={renderedArtifactKind !== null}
                      onClick={() => void createRenderedArtifact("pdf")}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-400/10 px-3 text-xs font-medium text-sky-100 transition hover:border-sky-300/80 hover:bg-sky-400/20 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      {renderedArtifactKind === "pdf" ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileDown className="h-3.5 w-3.5" />
                      )}
                      {t("crawlDeepUi.pagePdf")}
                    </button>
                  </div>
                </div>
                {renderedArtifactKind && (
                  <p role="status" className="mt-2 text-[11px] text-sky-200">
                    {t("crawlDeepUi.creatingArtifact", {
                      kind:
                        renderedArtifactKind === "pdf"
                          ? t("crawlDeepUi.pagePdf")
                          : t("crawlDeepUi.screenshot"),
                    })}
                  </p>
                )}
                {renderedArtifactError && (
                  <p
                    role="alert"
                    className="mt-2 break-words text-[11px] text-rose-300"
                  >
                    {renderedArtifactError}
                  </p>
                )}
                {renderedArtifact && (
                  <div className="mt-3 flex flex-col gap-1 rounded-md border border-sky-500/20 bg-slate-950/50 p-3 text-[11px] text-slate-400 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
                    <span className="text-sky-200">
                      {t("crawl.ui.createdAndDownloaded")}
                    </span>
                    <span
                      className="max-w-full truncate font-mono"
                      title={renderedArtifact.finalUrl}
                    >
                      {renderedArtifact.finalUrl}
                    </span>
                    <span>
                      {format(
                        new Date(renderedArtifact.capturedAt),
                        "yyyy-MM-dd HH:mm:ss",
                      )}
                    </span>
                    <span>{t("exportUi.statuses.bytes", { value: formatNumber(renderedArtifact.bytes) })}</span>
                    <span>{renderedArtifact.rendererPlatform}</span>
                    <button
                      type="button"
                      onClick={() => downloadRenderedArtifact(renderedArtifact)}
                      className="self-start text-sky-200 underline decoration-sky-400/50 underline-offset-2 hover:text-white sm:self-auto"
                    >
                      {t("crawlDeepUi.downloadAgain")}
                    </button>
                  </div>
                )}
              </section>
            )}
            <Table minWidth="min-w-[680px]">
              <thead className={tableHead}>
                <tr>
                  {[
                    t("crawl.ui.url"),
                    t("crawl.ui.httpStatusLabel"),
                    result.crawl_mode === "browser-rendered"
                      ? t("crawlDeepUi.navigation")
                      : t("crawl.ui.httpTime"),
                    t("crawlDeepUi.transfer"),
                    t("crawlDeepUi.contentType"),
                  ].map((label) => (
                    <th key={label} className={cell}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.pages.map((page) => (
                  <tr
                    key={page.url}
                    className="border-t border-slate-800/80 text-slate-300"
                  >
                    <td
                      className={`${cell} max-w-72 truncate font-mono`}
                      title={page.url}
                    >
                      {page.url}
                    </td>
                    <td className={`${cell} font-mono`}>
                      {page.http_status || page.request_error_kind || "—"}
                    </td>
                    <td className={`${cell} text-right font-mono`}>
                      {page.response_time_ms} {t("performance.milliseconds")}
                    </td>
                    <td className={`${cell} text-right font-mono`}>
                      {page.content_length == null
                        ? "—"
                        : t("exportUi.statuses.bytes", { value: formatNumber(page.content_length) })}
                    </td>
                    <td
                      className={`${cell} max-w-48 truncate`}
                      title={page.content_type ?? undefined}
                    >
                      {page.content_type || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        );
      }
};
