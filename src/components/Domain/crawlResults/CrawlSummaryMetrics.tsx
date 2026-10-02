

import { cell, formatNumber } from './crawlResultsHelpers';
import { CrawlRobotsSummaryRows } from './CrawlRobotsSummaryRows';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;
export const CrawlSummaryMetrics = ({ session }: { session: Session }) => {
const { crawlOnlyCount, result, sitemapOnlyCount, t } = session;
return (
    <>
      <tr>
        <th className={cell}>{t("crawl.ui.address")}</th>
        <td className={`${cell} break-all font-mono text-slate-300`}>
          {result.start_url}
        </td>
      </tr>
      <tr>
        <th className={cell}>{t("crawl.ui.healthScore")}</th>
        <td className={`${cell} font-mono text-white`}>
          {result.health_score} / 100
        </td>
      </tr>
      <tr>
        <th className={cell}>{t("crawl.ui.processedUrls")}</th>
        <td className={`${cell} font-mono text-slate-300`}>
          {result.pages_crawled}
        </td>
      </tr>
      {result.discovery_provenance_truncated ? (
        <tr>
          <th className={cell}>{t("crawl.ui.provenance")}</th>
          <td className={`${cell} text-amber-200`}>
            {t("crawl.ui.provenanceTruncated")}
          </td>
        </tr>
      ) : null}
      {result.limit_reasons?.length ? (
        <tr>
          <th className={cell}>{t("crawl.ui.limitReasons")}</th>
          <td className={`${cell} text-amber-200`}>
            {t("crawl.ui.limitReasonsValue", {
              reasons: result.limit_reasons.join(", "),
            })}
          </td>
        </tr>
      ) : null}
      <tr>
        <th className={cell}>{t("crawl.ui.issues")}</th>
        <td className={`${cell} text-slate-300`}>
          {t("crawl.ui.issueSummary", {
            critical: result.critical_count,
            warnings: result.warning_count,
            notices: result.notice_count,
          })}
        </td>
      </tr>
      <tr>
        <th className={cell}>{t("crawl.ui.runDuration")}</th>
        <td className={`${cell} font-mono text-slate-300`}>
          {formatNumber(result.duration_ms)} {t("performance.milliseconds")}
        </td>
      </tr>
      <CrawlRobotsSummaryRows session={session} />
      <tr>
        <th className={cell}>{t("crawl.ui.sitemapXml")}</th>
        <td className={`${cell} text-slate-300`}>
          {t("crawl.ui.sitemapSummary", {
            status: result.sitemap_status,
            count: result.sitemap_urls_discovered,
          })}
        </td>
      </tr>
      {result.sitemap_urls_discovered > 0 && (
        <tr>
          <th className={cell}>{t("crawl.ui.sitemapComparison")}</th>
          <td className={`${cell} text-slate-300`}>
            {t("crawl.ui.sitemapComparisonValue", {
              sitemapOnly: sitemapOnlyCount,
              crawlOnly: crawlOnlyCount,
            })}
          </td>
        </tr>
      )}
      <tr>
        <th className={cell}>{t("crawl.ui.links")}</th>
        <td className={`${cell} text-slate-300`}>
          {result.pages.reduce(
            (total, page) => total + page.internal_link_count,
            0,
          )}{" "}
          {t("crawl.ui.internalLinks")} ·{" "}
          {result.pages.reduce(
            (total, page) => total + page.external_link_count,
            0,
          )}{" "}
          {t("crawl.ui.externalLinks")}
        </td>
      </tr>
      {result.cancelled && (
        <tr>
          <th className={`${cell} text-amber-300`}>
            {t("crawl.ui.cancelled")}
          </th>
          <td className={`${cell} text-amber-200`}>
            {t("crawl.ui.cancelledValue")}
          </td>
        </tr>
      )}
      {result.timed_out && (
        <tr>
          <th className={`${cell} text-amber-300`}>{t("crawl.ui.timedOut")}</th>
          <td className={`${cell} text-amber-200`}>
            {t("crawl.ui.timedOutValue")}
          </td>
        </tr>
      )}
    </>
  );
};
