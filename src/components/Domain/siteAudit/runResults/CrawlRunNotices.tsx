import type { useSiteAuditSession } from '../useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;

interface CrawlRunNoticesProps {
  session: Session;
}

export const CrawlRunNotices = ({ session }: CrawlRunNoticesProps) => {
  const { crawlResult, t } = session;
  if (!crawlResult) return null;

  return (
    <>
      {crawlResult.cancelled && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {t("siteAudit.cancelledNotice")}
        </p>
      )}
      <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
        {t("siteAudit.robotsStatus", {
          status: crawlResult.robots_txt_status,
          count: crawlResult.robots_blocked_count,
        })}
      </p>
      <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
        {t("siteAudit.sitemapStatus", {
          status: crawlResult.sitemap_status,
          count: crawlResult.sitemap_urls_discovered,
        })}
      </p>
      {(crawlResult.rejected_urls?.length || 0) > 0 && (
        <details className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
          <summary className="cursor-pointer font-medium">
            {t("siteAudit.rejectedUrls", {
              count: crawlResult.rejected_urls?.length,
            })}
          </summary>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto font-mono text-[11px] text-slate-300">
            {crawlResult.rejected_urls?.map((item) => (
              <li key={`${item.url}-${item.reason}`}>
                {item.url} —{" "}
                <span className="text-amber-200">{item.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
};
