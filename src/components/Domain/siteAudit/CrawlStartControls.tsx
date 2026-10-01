import { Layers, Play, Loader2 } from "lucide-react";

import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlStartControls = ({ session }: { session: Session }) => {
const { crawlConfig, crawlProgressDetail, desktopAvailable, handleStartCrawl, inputUrl, isCrawling, selectedLimit, setCrawlConfig, setInputUrl, setSelectedLimit, t } = session;

return (<form
        id="site-audit-crawl-form"
        onSubmit={handleStartCrawl}
        className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col md:flex-row gap-3 shadow-lg"
      >
        <div className="flex-1 relative">
          <Layers className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            id="site-audit-start-url"
            type="text"
            value={inputUrl}
            aria-label={t("siteAudit.startUrlAria")}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder={t("siteAudit.urlPlaceholder")}
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-mono"
          />
        </div>

        <div className="w-full md:w-44">
          <select
            aria-label={t("siteAudit.pageLimitAria")}
            value={selectedLimit}
            onChange={(e) => setSelectedLimit(Number(e.target.value))}
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
          >
            {[25, 50, 100, 250, 500].map((limit) => (
              <option key={limit} value={limit}>
                {t("siteAudit.pageLimitOption", { count: limit })}
              </option>
            ))}
          </select>
        </div>

        <label className="w-full text-[11px] text-slate-400 md:w-52">
          {t("siteAudit.renderMode")}
          <select
            aria-label={t("siteAudit.renderModeAria")}
            value={crawlConfig.crawlMode || "http"}
            onChange={(event) =>
              setCrawlConfig({
                crawlMode: event.target.value as "http" | "browser-rendered",
              })
            }
            className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-400"
          >
            <option value="http">{t("siteAudit.renderModeHttp")}</option>
            <option value="browser-rendered">
              {t("siteAudit.renderModeBrowser")}
            </option>
          </select>
        </label>

        <button
          type="submit"
          disabled={isCrawling || !desktopAvailable}
          aria-disabled={isCrawling || !desktopAvailable}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center space-x-2 transition shadow-md shadow-emerald-950"
        >
          {isCrawling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {t("siteAudit.progress", {
                  completed: crawlProgressDetail?.completed ?? 0,
                  discovered: crawlProgressDetail?.discovered ?? 0,
                  rate: crawlProgressDetail?.pagesPerSecond
                    ? ` · ${t("siteAudit.rate", { value: crawlProgressDetail.pagesPerSecond.toFixed(1) })}`
                    : "",
                })}
              </span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>{t("siteAudit.crawlStart")}</span>
            </>
          )}
        </button>
      </form>);
};
