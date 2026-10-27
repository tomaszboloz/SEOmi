import type { useSiteAuditSession } from './useSiteAuditSession';
import { appLocale } from '@/services/localeFormat';

type Session = ReturnType<typeof useSiteAuditSession>;

export const CrawlResumePanel = ({ session }: { session: Session }) => {
  const { discardInterruptedCrawl, interruptedCrawl, resumeInterruptedCrawl, crawlConfig, t } = session;

  if (!interruptedCrawl) return null;

  const hasHistoricalConfig = Boolean(interruptedCrawl.config);

  return (
    <section
      className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4"
      role="status"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-amber-100">
            {t("siteAudit.interruptedTitle")}
          </h2>
          <p className="mt-1 break-all text-xs leading-5 text-amber-200/80">
            {t("siteAudit.interruptedDescription", {
              url: interruptedCrawl.url,
              limit: interruptedCrawl.limit ?? '',
              date: interruptedCrawl.startedAt ? new Date(interruptedCrawl.startedAt).toLocaleString(appLocale()) : '',
              completed:
                interruptedCrawl.completedUrls?.length?.toLocaleString(appLocale()) ||
                "",
              frontier:
                interruptedCrawl.frontierUrls?.length?.toLocaleString(appLocale()) ||
                "",
            })}
          </p>
          {!hasHistoricalConfig && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2.5 py-1 text-xs text-amber-200">
              <span className="font-medium text-amber-100">
                {t("siteAudit.interruptedMissingConfigNotice")}
              </span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {hasHistoricalConfig ? (
            <button
              type="button"
              onClick={() => void resumeInterruptedCrawl()}
              className="rounded-md bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-200"
            >
              {t("siteAudit.resumeCrawl")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void resumeInterruptedCrawl(crawlConfig)}
              className="rounded-md bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-200"
            >
              {t("siteAudit.resumeWithCurrentConfig")}
            </button>
          )}
          <button
            type="button"
            onClick={discardInterruptedCrawl}
            className="rounded-md border border-amber-400/35 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-400/10"
          >
            {t("siteAudit.discard")}
          </button>
        </div>
      </div>
    </section>
  );
};
