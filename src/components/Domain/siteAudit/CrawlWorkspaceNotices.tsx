import type { useSiteAuditSession } from './useSiteAuditSession';
type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlWorkspaceNotices = ({ session }: { session: Session }) => {
const { crawlError, crawlPersistenceCompacted, crawlPersistenceError, crawlPersistenceNotice, crawlResult, crawlRuns, isRetryingCrawlPersistence, retryCrawlPersistence, t } = session;
return (<>
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
</>);
};
