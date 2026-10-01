import { Map } from "lucide-react";

import { CrawlResultsTabs } from "@/components/Domain/CrawlResultsTabs";

import { ScheduledAuditsPanel } from "@/components/Domain/ScheduledAuditsPanel";

import { useSiteAuditSession } from './siteAudit/useSiteAuditSession';
import { CrawlWorkspaceNavigation } from './siteAudit/CrawlWorkspaceNavigation';
import { CrawlStartControls } from './siteAudit/CrawlStartControls';
import { CrawlEnvironmentComparison } from './siteAudit/CrawlEnvironmentComparison';
import { CrawlConfigurationForm } from './siteAudit/CrawlConfigurationForm';
import { CrawlCustomSearchEditor } from './siteAudit/CrawlCustomSearchEditor';
import { CrawlUrlRules } from './siteAudit/CrawlUrlRules';
import { CrawlSavedRequestProfiles } from './siteAudit/CrawlSavedRequestProfiles';
import { CrawlResumePanel } from './siteAudit/CrawlResumePanel';
import { CrawlProgressStatus } from './siteAudit/CrawlProgressStatus';
import { CrawlLegacyHistory } from './siteAudit/CrawlLegacyHistory';

export const SiteAudit = () => {
const session = useSiteAuditSession();
const { activeProjectId, crawlConfig, crawlError, crawlPersistenceCompacted, crawlPersistenceError, crawlPersistenceNotice, crawlRequestProfiles, crawlResult, crawlRuns, crawlUrl, customSearches, deleteCrawlRun, desktopAvailable, filterValidationError, inputUrl, interruptedCrawl, isCrawling, isRetryingCrawlPersistence, mapNavigationRequest, mapRequiresCrawl, retryCrawlPersistence, selectCrawlRun, selectedLimit, selectedRun, setMapNavigationRequest, sidebarCollapsed, t } = session;

return (<div
      className={`mx-auto max-w-7xl space-y-8 px-4 py-8 ${crawlResult ? "pb-28 sm:pb-24" : ""}`}
    >
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
          className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/90 bg-slate-950/95 px-3 py-2 shadow-lg shadow-black/20 backdrop-blur supports-[backdrop-filter]:bg-slate-950/90"
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

      {crawlResult && (
        <div
          className={`pointer-events-none fixed inset-x-3 z-50 md:right-4 ${sidebarCollapsed ? "md:left-[4.5rem]" : "md:left-[16.5rem]"}`}
          style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <CrawlWorkspaceNavigation session={session} />
        </div>
      )}

      {/* Crawl Control Form */}
      {mapRequiresCrawl && !crawlResult && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          {t("siteAudit.mapRequiresCrawl")}
        </p>
      )}

      <CrawlStartControls session={session} />

      {!desktopAvailable && (
        <p role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs text-amber-100">
          {t("runtimeErrors.tauri.desktopOnly")}
        </p>
      )}

      {filterValidationError && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
        >
          {t("siteAudit.filterValidationError")}{" "}
          <span className="break-words text-rose-200">
            {filterValidationError}
          </span>
        </p>
      )}

      {activeProjectId && (
        <ScheduledAuditsPanel
          projectId={activeProjectId}
          initialUrl={crawlUrl || inputUrl}
          crawlConfig={crawlConfig}
          crawlLimit={selectedLimit}
        />
      )}

      {activeProjectId && (
        <CrawlEnvironmentComparison session={session} />
      )}

      <details className="rounded-xl border border-slate-800 bg-slate-900/45">
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400">
          <span>{t("siteAudit.scopeTitle")}</span>
          <span className="text-[11px] font-normal text-slate-500">
            {t("siteAudit.scopeLimit", { count: selectedLimit })} ·{" "}
            {crawlConfig.allowSubdomains
              ? t("siteAudit.scopeSubdomains")
              : t("siteAudit.scopeCurrentHost")}
          </span>
        </summary>
        <CrawlConfigurationForm session={session} />
      </details>

      <details className="rounded-xl border border-slate-800 bg-slate-900/45">
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400">
          <span>{t("crawl.customSearch.label")}</span>
          <span className="text-[11px] font-normal text-slate-500">
            {t("crawl.customSearch.count", { count: customSearches.length })}
          </span>
        </summary>
        <CrawlCustomSearchEditor session={session} />
      </details>

      <details className="rounded-xl border border-slate-800 bg-slate-900/45">
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400">
          <span>{t("siteAudit.urlRulesTitle")}</span>
          <span className="text-[11px] font-normal text-slate-500">
            {t("siteAudit.includeCount", { count: crawlConfig.includePatterns.length })} ·{" "}
            {t("siteAudit.excludeCount", { count: crawlConfig.excludePatterns.length })}
          </span>
        </summary>
        <CrawlUrlRules session={session} />
      </details>

      <details className="rounded-xl border border-slate-800 bg-slate-900/45">
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400">
          <span>{t("siteAudit.requestProfileTitle")}</span>
          <span className="text-[11px] font-normal text-slate-500">
            {crawlConfig.requestProfileId
              ? crawlRequestProfiles.find(
                  (profile) => profile.id === crawlConfig.requestProfileId,
                )?.name || t("siteAudit.requestProfileSummary")
              : t("siteAudit.requestProfileSummary")}
          </span>
        </summary>
        <CrawlSavedRequestProfiles session={session} />
      </details>

      {interruptedCrawl && !isCrawling && (
        <CrawlResumePanel session={session} />
      )}

      {/* Crawl Progress Bar */}
      {isCrawling && (
        <CrawlProgressStatus session={session} />
      )}

      {crawlError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm">
          {crawlError}
        </div>
      )}

      {crawlPersistenceError && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-amber-100"
        >
          <p className="font-medium">{t("siteAudit.persistenceErrorTitle")}</p>
          <p className="mt-1 break-words text-xs text-amber-200/80">
            {crawlPersistenceError}
          </p>
          <button
            type="button"
            onClick={() => void retryCrawlPersistence()}
            disabled={isRetryingCrawlPersistence || !crawlRuns.length}
            className="mt-3 inline-flex h-8 items-center rounded-md border border-amber-300/40 px-3 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/10 disabled:cursor-wait disabled:opacity-60"
          >
            {isRetryingCrawlPersistence
              ? t("siteAudit.retryingSave")
              : t("siteAudit.retrySave")}
          </button>
        </div>
      )}

      {crawlPersistenceNotice && !crawlPersistenceError && (
        <div
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100"
        >
          <p className="font-medium">
            {crawlPersistenceCompacted
              ? t("crawl.persistence.recoveredTitle")
              : t("crawl.persistence.savedTitle")}
          </p>
          <p className="mt-1 break-words text-xs text-amber-200/80">
            {crawlPersistenceNotice}
          </p>
        </div>
      )}

      {crawlResult?.timed_out && (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-amber-100">
          {t("siteAudit.timedOut", { count: crawlResult.pages_crawled })}
        </div>
      )}

      {crawlResult && (
        <>
          <CrawlResultsTabs
            result={crawlResult}
            runs={crawlRuns}
            selectedRun={selectedRun}
            onSelectRun={selectCrawlRun}
            onDeleteRun={deleteCrawlRun}
            mapNavigationRequest={mapNavigationRequest}
          />
          <CrawlLegacyHistory session={session} />
        </>
      )}
    </div>);
};
