import type { TFunction } from 'i18next';
import type { CrawledPageSummary } from '@/types';
import { cell, tableHead } from './crawlResultsHelpers';
import { Table } from './CrawlViewPrimitives';

export const CrawlPaginationSection = ({ paginatedPages, t }: { paginatedPages: CrawledPageSummary[]; t: TFunction }) => (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {t("crawlDeepUi.pagination")}
      </h3>
      <Table minWidth="min-w-[1100px]">
        <thead className={tableHead}>
          <tr>
            {[
              t("crawl.ui.url"),
              t("crawlDeepUi.declarations"),
              t("crawlDeepUi.invalid"),
              t("crawlDeepUi.canonicalAlignment"),
              t("crawlDeepUi.relation"),
              t("crawlDeepUi.target"),
              t("crawlDeepUi.statusInRun"),
              t("crawlDeepUi.reciprocal"),
              t("crawlDeepUi.queryChanges"),
            ].map((label) => (
              <th key={label} className={cell}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedPages.flatMap((page) =>
            (page.pagination_links || []).map((link, index) => (
              <tr
                key={`${page.url}-${link.relation}-${index}`}
                className="border-t border-slate-800/80 text-slate-300"
              >
                <td
                  className={`${cell} max-w-56 truncate font-mono`}
                  title={page.url}
                >
                  {page.url}
                </td>
                <td className={`${cell} text-center font-mono`}>
                  {page.pagination_declaration_count ??
                    t("crawlDeepUi.legacyUnavailable")}
                </td>
                <td
                  className={`${cell} text-center font-mono ${page.pagination_invalid_declaration_count ? "text-amber-300" : ""}`}
                >
                  {page.pagination_invalid_declaration_count ??
                    t("crawlDeepUi.legacyUnavailable")}
                </td>
                <td className={`${cell} font-mono`}>
                  {page.pagination_canonical_alignment ||
                    t("crawlDeepUi.legacyUnavailable")}
                </td>
                <td className={`${cell} font-mono`}>
                  {link.relation}
                </td>
                <td
                  className={`${cell} max-w-72 break-all font-mono`}
                >
                  {link.target_url}
                </td>
                <td className={`${cell} font-mono`}>
                  {link.checked_in_run
                    ? link.http_status == null
                      ? t("crawlDeepUi.noResponse")
                      : t("crawl.ui.httpStatus", { status: link.http_status })
                    : t("crawlDeepUi.notCheckedThisRun")}
                </td>
                <td className={`${cell} font-mono`}>
                  {link.reciprocal_in_run === undefined ||
                  link.reciprocal_in_run === null
                    ? t("crawlDeepUi.reciprocityUnchecked")
                    : link.reciprocal_in_run
                      ? t("crawlDeepUi.yes")
                      : t("crawlDeepUi.no")}
                </td>
                <td className={`${cell} max-w-72`}>
                  {link.query_parameter_changes.length
                    ? link.query_parameter_changes.join(" · ")
                    : t("crawlDeepUi.noQueryChanges")}
                </td>
              </tr>
            )),
          )}
          {paginatedPages
            .filter((page) => !page.pagination_links?.length)
            .map((page) => (
              <tr
                key={`${page.url}-invalid-pagination`}
                className="border-t border-slate-800/80 text-slate-300"
              >
                <td
                  className={`${cell} max-w-56 truncate font-mono`}
                  title={page.url}
                >
                  {page.url}
                </td>
                <td className={`${cell} text-center font-mono`}>
                  {page.pagination_declaration_count ??
                    t("crawlDeepUi.legacyUnavailable")}
                </td>
                <td
                  className={`${cell} text-center font-mono text-amber-300`}
                >
                  {page.pagination_invalid_declaration_count ??
                    t("crawlDeepUi.legacyUnavailable")}
                </td>
                <td className={`${cell} font-mono`}>
                  {page.pagination_canonical_alignment ||
                    t("crawlDeepUi.legacyUnavailable")}
                </td>
                <td className={cell} colSpan={5}>
                  {t("crawlDeepUi.invalidPaginationTarget")}
                </td>
              </tr>
            ))}
        </tbody>
      </Table>
    </section>
);
