import { Loader2 } from "lucide-react";

import { formatCrawlElapsed } from './siteAuditHelpers';
import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlProgressStatus = ({ session }: { session: Session }) => {
const { cancelSiteCrawl, crawlProgress, crawlProgressDetail, isCrawlPaused, pauseSiteCrawl, resumeSiteCrawl, t } = session;

return (<div className="p-5 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-3">
          <div className="flex justify-between text-xs text-slate-300 font-mono">
            <span className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              {t("siteAudit.progressStatus")}
            </span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  void (isCrawlPaused ? resumeSiteCrawl() : pauseSiteCrawl())
                }
                className="rounded border border-amber-500/40 px-2 py-1 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-500/10"
              >
                {isCrawlPaused
                  ? t("siteAudit.resumeCrawl")
                  : t("siteAudit.pauseCrawl")}
              </button>
              <button
                type="button"
                onClick={() => void cancelSiteCrawl()}
                className="rounded border border-rose-500/40 px-2 py-1 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/10"
              >
                {t("siteAudit.cancelCrawl")}
              </button>
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${crawlProgress}%` }}
            />
          </div>
          {isCrawlPaused && (
            <p className="text-[11px] font-medium text-amber-200">
              {t("siteAudit.pausedNotice")}
            </p>
          )}
          {crawlProgressDetail?.currentUrl && (
            <p className="truncate text-[11px] font-mono text-slate-500">
              {crawlProgressDetail.currentUrl}
            </p>
          )}
          <div
            className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-3 text-[11px] text-slate-400 sm:grid-cols-4"
            aria-label={t("siteAudit.liveMetricsAria")}
            aria-live="polite"
          >
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-slate-600">
                {t("siteAudit.processed")}
              </span>
              <span className="mt-1 block font-mono text-slate-200">
                {crawlProgressDetail?.completed ?? 0}/{crawlProgressDetail?.discovered ?? 0}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-slate-600">
                {t("siteAudit.queued")}
              </span>
              <span className="mt-1 block font-mono text-slate-200">
                {crawlProgressDetail?.queued ?? 0}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-slate-600">
                {t("siteAudit.elapsed")}
              </span>
              <span className="mt-1 block font-mono text-slate-200">
                {formatCrawlElapsed(crawlProgressDetail?.elapsedMs)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-slate-600">
                {t("siteAudit.throughput")}
              </span>
              <span className="mt-1 block font-mono text-slate-200">
                {t("siteAudit.rate", { value: (crawlProgressDetail?.pagesPerSecond ?? 0).toFixed(1) })}
              </span>
            </div>
          </div>
        </div>);
};
