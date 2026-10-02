
import { CrawlResultsTabs } from "@/components/Domain/CrawlResultsTabs";

import { ScheduledAuditsPanel } from "@/components/Domain/ScheduledAuditsPanel";

import { useSiteAuditSession } from './siteAudit/useSiteAuditSession';
import { CrawlWorkspaceHeader } from './siteAudit/CrawlWorkspaceHeader';
import { CrawlWorkspaceNotices } from './siteAudit/CrawlWorkspaceNotices';
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
const { activeProjectId, crawlConfig, crawlRequestProfiles, crawlResult, crawlRuns, crawlUrl, customSearches, deleteCrawlRun, desktopAvailable, filterValidationError, inputUrl, interruptedCrawl, isCrawling, mapNavigationRequest, mapRequiresCrawl, selectCrawlRun, selectedLimit, selectedRun, t } = session;

return (<div
      className={`mx-auto max-w-7xl space-y-8 px-4 py-8 ${crawlResult ? "pb-28 sm:pb-24" : ""}`}
    >
      <CrawlWorkspaceHeader session={session} />

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

      <CrawlWorkspaceNotices session={session} />

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
