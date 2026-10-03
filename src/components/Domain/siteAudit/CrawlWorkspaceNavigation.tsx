import { ArrowUp, Map } from "lucide-react";

import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlWorkspaceNavigation = ({ session }: { session: Session }) => {
const { crawlResult, scrollToResults, setMapNavigationRequest, t } = session;

if (!crawlResult) return null;
return (<nav
            aria-label={t("siteAudit.fixedNavAria")}
            className="pointer-events-auto mx-auto grid w-full max-w-5xl grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-slate-700/90 bg-slate-950/95 px-2.5 py-2 shadow-2xl shadow-black/40 backdrop-blur supports-[backdrop-filter]:bg-slate-950/85"
          >
            <span className="hidden shrink-0 items-center gap-1.5 px-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:inline-flex">
              {t("siteAudit.auditCount")}
              <span className="font-mono text-slate-300">
                {crawlResult.pages_crawled}
              </span>
            </span>
            <div className="grid min-w-0 grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => scrollToResults()}
                title={t("siteAudit.backToResults")}
                className="inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-[11px] font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                aria-label={t("siteAudit.backToResults")}
              >
                <ArrowUp className="h-3.5 w-3.5" />
                <span className="sm:hidden">{t("siteAudit.resultsShort")}</span>
                <span className="hidden truncate sm:inline">
                  {t("siteAudit.resultsLong")}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setMapNavigationRequest((request) => request + 1)
                }
                title={t("siteAudit.mapDirect")}
                className="inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-400/45 bg-emerald-400/10 px-2.5 text-[11px] font-semibold text-emerald-100 transition hover:border-emerald-300/80 hover:bg-emerald-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                aria-label={`${t("siteAudit.mapDirect")}, ${crawlResult.pages_crawled}`}
              >
                <Map className="h-3.5 w-3.5" />
                <span className="sm:hidden">{t("siteAudit.mapShort")}</span>
                <span className="hidden truncate sm:inline">
                  {t("siteAudit.mapLong")}
                </span>
              </button>
            </div>
          </nav>);
};
