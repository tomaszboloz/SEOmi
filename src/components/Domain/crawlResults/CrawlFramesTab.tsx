

import { cell, tableHead } from './crawlResultsHelpers';
import { Empty, Table } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlFramesTab = ({ session }: { session: Session }) => {
const { result, t } = session;
{
        const frames = result.pages.flatMap((page) =>
          (page.frames || []).map((frame, index) => ({
            page,
            frame,
            key: `${page.url}-${frame.resolved_url || frame.src || "blank"}-${index}`,
          })),
        );
        return (
          <div className="space-y-3">
            <p className="text-[11px] leading-5 text-slate-500">
              {t("crawl.ui.framesDescription")}
            </p>
            {frames.length ? (
              <>
                <Table minWidth="min-w-[900px]">
                  <thead className={tableHead}>
                    <tr>
                      {[
                        t("crawl.ui.sourcePage"),
                        t("crawl.ui.declaredSrc"),
                        t("crawl.ui.resolvedUrl"),
                        t("crawl.ui.httpStatusLabel"),
                        t("crawl.ui.title"),
                        t("crawl.ui.name"),
                        t("crawl.ui.loading"),
                        t("crawl.ui.sandbox"),
                      ].map((label) => (
                        <th key={label} className={cell}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {frames.map(({ page, frame, key }) => {
                      const status = frame.checked_in_run
                        ? frame.http_status
                          ? t("crawl.ui.httpStatus", { status: frame.http_status })
                          : frame.request_error_kind
                            ? t("crawl.ui.requestError", {
                                kind: frame.request_error_kind,
                              })
                            : t("crawl.ui.checkedNoStatus")
                        : frame.resolved_url
                          ? t("crawl.ui.notChecked")
                          : t("crawl.ui.noHttpTarget");
                      return (
                        <tr
                          key={key}
                          className="border-t border-slate-800/80 align-top text-slate-300"
                        >
                          <td
                            className={`${cell} max-w-56 truncate font-mono`}
                            title={page.url}
                          >
                            {page.url}
                          </td>
                          <td
                            className={`${cell} max-w-56 break-all font-mono`}
                          >
                            {frame.src || t("crawl.ui.noSrcBlank")}
                          </td>
                          <td
                            className={`${cell} max-w-64 break-all font-mono`}
                          >
                            {frame.resolved_url || "—"}
                          </td>
                          <td
                            className={`${cell} font-mono ${frame.request_error_kind || (frame.http_status && frame.http_status >= 400) ? "text-rose-300" : frame.checked_in_run ? "text-emerald-300" : "text-slate-500"}`}
                          >
                            {status}
                          </td>
                          <td className={cell}>{frame.title || "—"}</td>
                          <td className={cell}>{frame.name || "—"}</td>
                          <td className={cell}>{frame.loading || "—"}</td>
                          <td
                            className={`${cell} max-w-48 break-all font-mono`}
                          >
                            {frame.sandbox ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                {result.pages.some((page) => page.frames_truncated) && (
                  <p className="text-[11px] text-amber-300">
                    {t("crawl.ui.framesTruncated")}
                  </p>
                )}
              </>
            ) : (
              <Empty>{t("crawl.ui.noFrames")}</Empty>
            )}
          </div>
        );
      }
};
