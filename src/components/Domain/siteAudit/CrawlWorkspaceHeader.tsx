import { Map } from "lucide-react";
import type { useSiteAuditSession } from './useSiteAuditSession';
type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlWorkspaceHeader = ({ session }: { session: Session }) => {
const { crawlResult, setMapNavigationRequest, t } = session;
return (<>
{/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {t("siteAudit.headerBadge")}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {t("siteAudit.headerCrawler")}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            {t("siteAudit.title")}
          </h1>
          <p className="text-sm text-slate-400">{t("siteAudit.description")}</p>
        </div>
        {crawlResult && (
          <button
            type="button"
            onClick={() => setMapNavigationRequest((request) => request + 1)}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-100 transition hover:border-emerald-300/70 hover:bg-emerald-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label={t("siteAudit.openMapAria", {
              count: crawlResult.pages_crawled,
            })}
          >
            <Map className="h-4 w-4" />
            <span>{t("siteAudit.openMap")}</span>
            <span className="rounded bg-slate-950/50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-200">
              {crawlResult.pages_crawled}
            </span>
          </button>
        )}
      </div>

      {crawlResult && (
        <nav
          aria-label={t("siteAudit.resultsNavAria")}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/90 bg-slate-950 px-3 py-2 shadow-lg shadow-black/20"
        >
          <span className="text-[11px] font-medium text-slate-400">
            {t("siteAudit.resultsCount", { count: crawlResult.pages_crawled })}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href="#crawl-results"
              className="inline-flex h-8 items-center rounded-md border border-slate-700 px-2.5 text-[11px] font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              {t("siteAudit.resultsLink")}
            </a>
            <button
              type="button"
              onClick={() => setMapNavigationRequest((request) => request + 1)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-400/35 bg-emerald-400/10 px-2.5 text-[11px] font-medium text-emerald-200 transition hover:border-emerald-300/70 hover:bg-emerald-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              aria-label={t("siteAudit.openMapAria", {
                count: crawlResult.pages_crawled,
              })}
            >
              <Map className="h-3.5 w-3.5" />
              {t("siteAudit.mapLink")}
            </button>
          </div>
        </nav>
      )}
</>);
};
