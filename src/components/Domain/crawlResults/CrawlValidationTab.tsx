

import { localizeHtmlValidationFinding } from "@/services/htmlValidationLocalization";
import { cell, tableHead } from './crawlResultsHelpers';
import { Empty, Table } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlValidationTab = ({ session }: { session: Session }) => {
const { result, setValidationQuery, setValidationSeverity, t, validationQuery, validationSeverity } = session;
{
        const checkedPages = result.pages.filter(
          (page) =>
            page.html_validation_findings !== undefined ||
            page.detected_charset !== undefined,
        );
        const normalizedValidationQuery = validationQuery
          .trim()
          .toLocaleLowerCase();
        const validationPages = checkedPages
          .map((page) => {
            const pageMatches = normalizedValidationQuery
              ? [page.url, page.charset, page.detected_charset]
                  .filter(Boolean)
                  .some((value) =>
                    String(value)
                      .toLocaleLowerCase()
                      .includes(normalizedValidationQuery),
                  )
              : true;
            const findings = (page.html_validation_findings || []).filter(
              (finding) => {
                if (
                  validationSeverity !== "all" &&
                  finding.severity !== validationSeverity
                ) {
                  return false;
                }
                if (!normalizedValidationQuery || pageMatches) return true;
                return [
                  finding.code,
                  finding.message,
                  finding.element,
                  finding.attribute,
                  finding.value,
                  finding.source_excerpt,
                ]
                  .filter(Boolean)
                  .some((value) =>
                    String(value)
                      .toLocaleLowerCase()
                      .includes(normalizedValidationQuery),
                  );
              },
            );
            return { page, findings, pageMatches };
          })
          .filter(
            ({ findings, pageMatches }) =>
              (!normalizedValidationQuery && validationSeverity === "all") ||
              pageMatches ||
              findings.length > 0,
          );
        const validationFindingCount = validationPages.reduce(
          (count, item) => count + item.findings.length,
          0,
        );
        return checkedPages.length ? (
          <div className="space-y-3">
            <div className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/30 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
              <label className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {t("crawlDeepUi.searchEvidence")}
                <input
                  aria-label={t("crawl.ui.searchHtmlValidation")}
                  value={validationQuery}
                  onChange={(event) => setValidationQuery(event.target.value)}
                  placeholder={t("crawl.ui.searchHtmlValidationPlaceholder")}
                  className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs normal-case tracking-normal text-slate-200 outline-none focus:border-emerald-400"
                />
              </label>
              <label className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {t("crawl.ui.severity")}
                <select
                  aria-label={t("crawl.ui.validationSeverity")}
                  value={validationSeverity}
                  onChange={(event) =>
                    setValidationSeverity(
                      event.target.value as "all" | "Error" | "Warning",
                    )
                  }
                  className="mt-1 h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs normal-case tracking-normal text-slate-200 outline-none focus:border-emerald-400"
                >
                  <option value="all">{t("crawl.ui.all")}</option>
                  <option value="Error">{t("crawl.ui.error")}</option>
                  <option value="Warning">{t("crawl.ui.warning")}</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setValidationQuery("");
                  setValidationSeverity("all");
                }}
                disabled={!validationQuery && validationSeverity === "all"}
                className="h-8 rounded-md border border-slate-700 px-2.5 text-[11px] text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("crawlDeepUi.clearFilter")}
              </button>
              <p className="text-[10px] text-slate-500 sm:col-span-3">
                {t("crawlDeepUi.matchedFindings", {
                  pages: validationPages.length,
                  findings: validationFindingCount,
                })}
              </p>
            </div>
            <p className="text-[11px] leading-5 text-slate-500">
              {t("crawlDeepUi.htmlValidationNote")}
            </p>
            {validationPages.length ? (
              <Table minWidth="min-w-[1100px]">
                <thead className={tableHead}>
                  <tr>
                    {[
                      t("crawlDeepUi.sourceUrl"),
                      t("crawlDeepUi.httpCharset"),
                      t("crawlDeepUi.decoderCharset"),
                      t("crawlDeepUi.localFindings"),
                    ].map((label) => (
                      <th key={label} className={cell}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validationPages.map(({ page, findings }) => (
                    <tr
                      key={page.url}
                      className="border-t border-slate-800/80 align-top text-slate-300"
                    >
                      <td
                        className={`${cell} max-w-72 break-all font-mono`}
                        title={page.url}
                      >
                        {page.url}
                      </td>
                      <td className={`${cell} font-mono`}>
                        {page.charset || t("crawlDeepUi.notDeclared")}
                      </td>
                      <td className={`${cell} font-mono`}>
                        {page.detected_charset ||
                          (page.body_truncated
                            ? t("crawlDeepUi.bodyTruncated")
                            : t("crawlDeepUi.noData"))}
                      </td>
                      <td className={cell}>
                        {findings.length ? (
                          <details open>
                            <summary className="cursor-pointer text-amber-200">
                              {t("crawlDeepUi.findingCountShort", {
                                count: findings.length,
                              })}
                              {page.html_validation_truncated
                                ? t("crawlDeepUi.limitedResult")
                                : ""}
                            </summary>
                            <ul className="mt-2 max-w-2xl space-y-2">
                              {findings.map((finding, index) => (
                                <li
                                  key={`${finding.code}-${index}`}
                                  className={`rounded-md border p-2 ${finding.severity === "Error" ? "border-rose-500/20 bg-rose-500/5" : "border-amber-500/20 bg-amber-500/5"}`}
                                >
                                  <p className="font-medium">
                                    {(finding.severity === "Error" ? t("componentUi.error") : t("crawl.ui.warning"))} · {finding.code}
                                    {finding.line
                                      ? ` · ${t("crawlDeepUi.line")} ${finding.line}${finding.column ? `:${finding.column}` : ""}`
                                      : ""}
                                  </p>
                                  <p className="mt-1">{localizeHtmlValidationFinding(finding, t).displayMessage}</p>
                                  <details className="mt-2 text-[10px] text-slate-500">
                                    <summary className="cursor-pointer text-slate-400">{t("htmlValidationFindings.sourceEvidence")}</summary>
                                    <p className="mt-1 break-words font-mono">{finding.message}</p>
                                  </details>
                                  {(finding.element || finding.attribute) && (
                                    <p className="mt-1 font-mono text-[10px] text-slate-400">
                                      {finding.element
                                        ? `<${finding.element}>`
                                        : ""}
                                      {finding.attribute
                                        ? ` [${finding.attribute}]`
                                        : ""}
                                    </p>
                                  )}
                                  {finding.value && (
                                    <code className="mt-1 block max-w-full break-all rounded bg-slate-950/70 p-1 font-mono text-[10px] text-slate-300">
                                      {finding.value}
                                    </code>
                                  )}
                                  {finding.source_excerpt && (
                                    <pre className="mt-1 max-w-2xl overflow-auto whitespace-pre-wrap break-all rounded bg-slate-950/70 p-1 font-mono text-[10px] text-slate-400">
                                      {finding.source_excerpt}
                                    </pre>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : page.html_validation_findings ? (
                          t("crawlDeepUi.noLocalRuleFindings")
                        ) : (
                          t("crawlDeepUi.legacySnapshotNoData")
                        )}
                        {page.html_validation_truncated && (
                          <p className="mt-1 text-[10px] text-amber-300">
                            {t("crawlDeepUi.validationTruncatedNote")}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Empty>{t("crawl.ui.noHtmlFindings")}</Empty>
            )}
          </div>
        ) : (
          <Empty>{t("crawlDeepUi.noValidationResults")}</Empty>
        );
      }
};
