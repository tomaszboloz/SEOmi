

import type { CrawledPageSummary, FaviconData } from "@/types";

import { cell, tableHead, formatNumber } from './crawlResultsHelpers';
import { Empty, Table } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlSocialTab = ({ session }: { session: Session }) => {
const { result, t } = session;
{
        const socialPages = result.pages.filter(
          (page) =>
            (page.favicons?.length || page.favicon_metadata?.length || 0) > 0 ||
            (page.social_meta_tags?.length || 0) > 0,
        );
        if (!socialPages.length)
          return <Empty>{t("crawl.social.empty")}</Empty>;
        const resourceStatus = (
          check: NonNullable<
            CrawledPageSummary["favicon_resource_checks"]
          >[number],
        ) => {
          if (!check.checked_in_run) return t("crawl.social.notChecked");
          if (check.request_error_kind)
            return t("crawl.social.requestError", {
              kind: check.request_error_kind,
            });
          return [
            check.http_status == null
              ? t("crawl.social.noHttpStatus")
              : t("crawl.ui.httpStatus", { status: check.http_status }),
            check.content_length == null
              ? null
              : `${formatNumber(check.content_length)} B`,
            check.intrinsic_width && check.intrinsic_height
              ? `${check.intrinsic_width} × ${check.intrinsic_height} · ${check.dimensions_source || t("crawl.social.intrinsic")}`
              : null,
            check.content_type || null,
          ]
            .filter(Boolean)
            .join(" · ");
        };
        const renderTags = (
          page: CrawledPageSummary,
          prefix: "og:" | "twitter:",
        ) => {
          const tags = (page.social_meta_tags || []).filter((tag) =>
            tag.key.startsWith(prefix),
          );
          return tags.length ? (
            <div className="max-w-[420px] space-y-2">
              {tags.map((tag, index) => (
                <div key={`${tag.key}-${index}`} className="break-words">
                  <p>
                    <span className="font-mono text-slate-500">
                      {tag.key}:{" "}
                    </span>
                    {tag.content === undefined || tag.content === null ? (
                      <span className="italic text-amber-300">
                        {t("crawl.social.missingContent")}
                      </span>
                    ) : tag.content === "" ? (
                      <span className="italic text-amber-300">
                        {t("crawl.social.emptyContent")}
                      </span>
                    ) : (
                      tag.content
                    )}
                  </p>
                  {tag.resource_check && (
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {resourceStatus(tag.resource_check)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-slate-500">
              {t("crawl.social.noDeclaration")}
            </span>
          );
        };
        return (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500">
              {t("crawl.social.disclaimer")}
            </p>
            <Table minWidth="min-w-[1080px]">
              <thead className={tableHead}>
                <tr>
                  {[
                    t("crawl.social.sourceUrl"),
                    t("crawl.social.faviconColumn"),
                    t("crawl.social.openGraphColumn"),
                    t("crawl.social.twitterColumn"),
                  ].map((label) => (
                    <th key={label} className={cell}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {socialPages.map((page) => (
                  <tr
                    key={page.url}
                    className="border-t border-slate-800/80 text-slate-300"
                  >
                    <td
                      className={`${cell} max-w-64 truncate font-mono`}
                      title={page.url}
                    >
                      {page.url}
                    </td>
                    <td className={cell}>
                      {page.favicons?.length ||
                      page.favicon_metadata?.length ? (
                        <div className="max-w-64 space-y-2">
                          {(
                            (page.favicon_metadata?.length
                              ? page.favicon_metadata
                              : (page.favicons || []).map(
                                  (href): FaviconData => ({ href, rel: "" }),
                                )) as FaviconData[]
                          ).map((favicon, index) => {
                            const check = page.favicon_resource_checks?.find(
                              (candidate) => candidate.url === favicon.href,
                            );
                            return (
                              <div
                                key={`${favicon.href}-${favicon.rel}-${index}`}
                              >
                                <p className="break-all font-mono">
                                  {favicon.href}
                                </p>
                                {(favicon.rel ||
                                  favicon.declared_type ||
                                  favicon.declared_sizes ||
                                  favicon.inferred_format) && (
                                  <p className="mt-0.5 text-[10px] text-slate-500">
                                    {[
                                      favicon.rel
                                        ? t("crawl.social.faviconRel", {
                                            value: favicon.rel,
                                          })
                                        : null,
                                      favicon.declared_type
                                        ? t("crawl.social.faviconType", {
                                            value: favicon.declared_type,
                                          })
                                        : null,
                                      favicon.declared_sizes
                                        ? t("crawl.social.faviconSizes", {
                                            value: favicon.declared_sizes,
                                          })
                                        : null,
                                      favicon.inferred_format
                                        ? t("crawl.social.faviconFormat", {
                                            value: favicon.inferred_format,
                                          })
                                        : null,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                )}
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                  {check
                                    ? resourceStatus(check)
                                    : t("crawl.social.noResourceStatus")}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-500">
                          {t("crawl.social.noDeclaration")}
                        </span>
                      )}
                    </td>
                    <td className={cell}>{renderTags(page, "og:")}</td>
                    <td className={cell}>{renderTags(page, "twitter:")}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        );
      }
};
