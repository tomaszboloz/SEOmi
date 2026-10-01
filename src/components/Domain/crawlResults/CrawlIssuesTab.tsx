

import { localizeCrawlIssue } from "@/services/crawlIssueLocalization";

import { cell, tableHead } from './crawlResultsHelpers';
import { Empty, Table } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlIssuesTab = ({ session }: { session: Session }) => {
const { result, t } = session;
{
        const issues = result.pages.flatMap((page) =>
          page.issues.map((issue, index) => ({
            page,
            issue,
            key: `${page.url}-${index}`,
          })),
        );
        return issues.length ? (
          <Table minWidth="min-w-[760px]">
            <thead className={tableHead}>
              <tr>
                <th className={cell}>{t("crawl.ui.severity")}</th>
                <th className={cell}>{t("crawl.ui.problem")}</th>
                <th className={cell}>{t("crawl.ui.url")}</th>
              </tr>
            </thead>
            <tbody>
              {issues.map(({ page, issue, key }) => (
                <tr key={key} className="border-t border-slate-800/80">
                  <td
                    className={`${cell} ${issue.severity === "Critical" ? "text-rose-300" : issue.severity === "Warning" ? "text-amber-300" : "text-slate-400"}`}
                  >
                    {t(`crawl.ui.severityValues.${issue.severity.toLowerCase()}`)}
                  </td>
                  <td className={`${cell} text-slate-200`}>
                    {localizeCrawlIssue(issue, t).displayMessage}
                  </td>
                  <td
                    className={`${cell} max-w-[360px] truncate font-mono text-slate-400`}
                    title={page.url}
                  >
                    {page.url}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>{t("crawl.ui.noIssues")}</Empty>
        );
      }
};
