import type { useSiteAuditSession } from '../useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;

export const CrawlSitemapComparisonCards = ({ session }: { session: Session }) => {
  const { crawlOnlyUrls, crawlResult, sitemapOnlyUrls, t } = session;

  if (!crawlResult || crawlResult.sitemap_urls_discovered <= 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
        <p className="text-xs text-sky-200">
          {t("siteAudit.sitemapOnlyTitle")}
        </p>
        <p className="mt-1 text-2xl font-semibold text-white">
          {sitemapOnlyUrls.length}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          {t("siteAudit.sitemapOnlyDescription")}
        </p>
      </div>
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
        <p className="text-xs text-violet-200">
          {t("siteAudit.crawlOnlyTitle")}
        </p>
        <p className="mt-1 text-2xl font-semibold text-white">
          {crawlOnlyUrls.length}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          {t("siteAudit.crawlOnlyDescription")}
        </p>
      </div>
    </div>
  );
};
