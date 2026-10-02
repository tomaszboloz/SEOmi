

import { cell, tableHead } from './crawlResultsHelpers';
import { CrawlPaginationSection } from './CrawlPaginationSection';
import { Empty, Table } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlInternationalTab = ({ session }: { session: Session }) => {
const { result, t } = session;
{
        const pagesWithInternational = result.pages.filter(
          (page) =>
            page.document_language || page.hreflangs.length || page.amp_url,
        );
        const paginatedPages = result.pages.filter(
          (page) =>
            page.pagination_declaration_count ||
            page.pagination_links?.length ||
            page.pagination_next ||
            page.pagination_prev,
        );
        return pagesWithInternational.length || paginatedPages.length ? (
          <div className="space-y-5">
            {pagesWithInternational.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t("crawlDeepUi.languageHreflangAmp")}
                </h3>
                <Table minWidth="min-w-[900px]">
                  <thead className={tableHead}>
                    <tr>
                      {[
                        t("crawl.ui.url"),
                        t("crawl.ui.language"),
                        t("crawlDeepUi.hreflang"),
                        t("crawlDeepUi.amp"),
                        t("crawlDeepUi.ampStatus"),
                        t("crawlDeepUi.canonicalAlignment"),
                      ].map((label) => (
                        <th key={label} className={cell}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagesWithInternational.map((page) => (
                      <tr
                        key={page.url}
                        className="border-t border-slate-800/80 text-slate-300"
                      >
                        <td
                          className={`${cell} max-w-56 truncate font-mono`}
                          title={page.url}
                        >
                          {page.url}
                        </td>
                        <td className={cell}>
                          {page.document_language || "—"}
                        </td>
                        <td className={`${cell} max-w-72`}>
                          {page.hreflangs.length
                            ? page.hreflangs.map((item) => (
                                <div
                                  key={`${item.language}-${item.target_url}`}
                                  className="break-all"
                                >
                                  <span className="text-slate-500">
                                    {item.language} ·{" "}
                                  </span>
                                  {item.target_url}
                                  <span className="block text-[10px] text-slate-500">
                                    {item.target_checked_in_run
                                      ? t("crawl.ui.httpStatus", { status: item.target_http_status ?? t("crawlDeepUi.noResponse") })
                                      : t("crawlDeepUi.statusOutsideRun")}{" "}
                                    ·{" "}
                                    {item.reciprocal_in_run == null
                                      ? t("crawlDeepUi.reciprocityUnchecked")
                                      : item.reciprocal_in_run
                                        ? t("crawlDeepUi.yes")
                                        : t("crawlDeepUi.noReciprocal")}{" "}
                                    ·{" "}
                                    {item.target_canonical_alignment ||
                                      t("crawlDeepUi.canonicalOutsideRun")}
                                  </span>
                                </div>
                              ))
                            : "—"}
                        </td>
                        <td
                          className={`${cell} max-w-52 break-all font-mono`}
                          title={page.amp_url ?? undefined}
                        >
                          {page.amp_url || "—"}
                        </td>
                        <td className={`${cell} font-mono`}>
                          {page.amp_url
                            ? page.amp_target_checked_in_run
                              ? page.amp_target_http_status == null
                                ? t("crawlDeepUi.noResponse")
                                : t("crawl.ui.httpStatus", { status: page.amp_target_http_status })
                              : t("crawlDeepUi.notCheckedThisRun")
                            : t("crawlDeepUi.noDirectives")}
                        </td>
                        <td className={cell}>
                          {page.amp_url
                            ? page.amp_target_canonical_alignment ===
                              "canonical-to-source"
                              ? t("crawlDeepUi.yes")
                              : page.amp_target_canonical_alignment ===
                                  "missing-canonical"
                                ? t("crawlDeepUi.noDirectives")
                                : page.amp_target_canonical_alignment
                                  ? t("crawlDeepUi.no")
                                  : t("crawlDeepUi.canonicalOutsideRun")
                            : t("crawlDeepUi.noDirectives")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </section>
            )}
            {paginatedPages.length > 0 && (
              <CrawlPaginationSection paginatedPages={paginatedPages} t={t} />
            )}
          </div>
        ) : (
          <Empty>{t("crawlDeepUi.noInternationalSignals")}</Empty>
        );
      }
};
