

import { FileDown } from "lucide-react";
import { format } from "date-fns";

import { downloadCrawlCustomSearchCsv, downloadCrawlHtml, downloadCrawlImagesCsv, downloadCrawlIssuesCsv, downloadCrawlJson, downloadCrawlLinksCsv, downloadCrawlPagesCsv, downloadCrawlResourcesCsv, downloadCrawlFramesCsv } from "@/services/export";

import { Empty } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;
const completionLabel = (value: string): string => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? format(date, "yyyy-MM-dd HH:mm") : "—";
};

export const CrawlExportsTab = ({ session }: { session: Session }) => {
const { currentRun, exportPdf, pdfError, t } = session;
return currentRun ? (
          <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/45 p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {t("crawlDeepUi.savedDataExport")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {t("crawlDeepUi.exportRunDescription", {
                  id: currentRun.id,
                  date: completionLabel(currentRun.completedAt),
                  url: currentRun.startUrl,
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                [t("crawlDeepUi.exportJson"), () => downloadCrawlJson(currentRun)],
                [t("crawlDeepUi.exportPdf"), () => void exportPdf()],
                [t("crawlDeepUi.exportHtml"), () => downloadCrawlHtml(currentRun)],
                [t("crawlDeepUi.exportUrlsCsv"), () => downloadCrawlPagesCsv(currentRun)],
                [t("crawlDeepUi.exportLinksCsv"), () => downloadCrawlLinksCsv(currentRun)],
                [t("crawlDeepUi.exportImagesCsv"), () => downloadCrawlImagesCsv(currentRun)],
                [t("crawlDeepUi.exportFramesCsv"), () => downloadCrawlFramesCsv(currentRun)],
                [
                  t("crawlDeepUi.exportCustomSearchCsv"),
                  () => downloadCrawlCustomSearchCsv(currentRun),
                ],
                [t("crawlDeepUi.exportResourcesCsv"), () => downloadCrawlResourcesCsv(currentRun)],
                [t("crawlDeepUi.exportIssuesCsv"), () => downloadCrawlIssuesCsv(currentRun)],
              ].map(([label, action]) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={action as () => void}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-emerald-400/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  {label as string}
                </button>
              ))}
            </div>
            {pdfError && (
              <p role="alert" className="text-xs text-rose-300">
                {pdfError}
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              {t("crawlDeepUi.exportSafetyNote")}
            </p>
          </section>
        ) : (
          <Empty>{t("crawlDeepUi.incompleteRunExport")}</Empty>
        );
};
