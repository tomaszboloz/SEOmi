

import { localizeStructuredDataFinding } from "@/services/schemaIssueLocalization";

import { cell, tableHead } from './crawlResultsHelpers';
import { Empty, Table } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlStructuredTab = ({ session }: { session: Session }) => {
const { result, t } = session;
return result.pages.some(
          (page) =>
            page.schema_types.length ||
            page.schema_syntax_errors > 0 ||
            page.schema_validation_findings?.length,
        ) ? (
          <Table minWidth="min-w-[900px]">
            <thead className={tableHead}>
              <tr>
                {[
                  t("crawlDeepUi.sourceUrl"),
                  t("crawlDeepUi.detectedTypes"),
                  t("crawlDeepUi.jsonLdErrors"),
                  t("crawlDeepUi.localFindings"),
                ].map((label) => (
                  <th key={label} className={cell}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.pages
                .filter(
                  (page) =>
                    page.schema_types.length ||
                    page.schema_syntax_errors > 0 ||
                    page.schema_validation_findings?.length,
                )
                .map((page) => (
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
                    <td className={`${cell} max-w-72`}>
                      {page.schema_types.length
                        ? page.schema_types.join(", ")
                        : t("crawlDeepUi.notDetected")}
                    </td>
                    <td
                      className={`${cell} text-center font-mono ${page.schema_syntax_errors ? "text-rose-300" : "text-slate-400"}`}
                    >
                      {page.schema_syntax_errors}
                    </td>
                    <td className={cell}>
                      {page.schema_validation_findings?.length ? (
                        <details>
                          <summary className="cursor-pointer text-emerald-200">
                            {t("crawlDeepUi.findingCount", {
                              count: page.schema_validation_findings.length,
                            })}
                            {page.schema_validation_truncated
                              ? t("crawlDeepUi.partial")
                              : ""}
                          </summary>
                          <ul className="mt-2 max-w-xl space-y-2">
                            {page.schema_validation_findings.map(
                              (item, index) => {
                                const localized = localizeStructuredDataFinding(item.finding, {
                                  format: item.format,
                                  dataType: page.schema_types.join(', ') || t('schemaFindings.unknownType'),
                                }, t);
                                return <li
                                  key={`${item.format}-${item.declaration_index}-${item.finding.code}-${index}`}
                                  className={`rounded-md border p-2 ${item.finding.severity === "error" ? "border-rose-500/20 bg-rose-500/5" : item.finding.severity === "warning" ? "border-amber-500/20 bg-amber-500/5" : "border-sky-500/20 bg-sky-500/5"}`}
                                >
                                  <p className="font-medium">
                                    {localized.displaySeverity} ·{" "}
                                    {item.format} #{item.declaration_index}
                                  </p>
                                  <p className="mt-1">{localized.displayMessage}</p>
                                  {item.finding.path && (
                                    <p className="mt-1 break-all font-mono text-[10px] text-slate-400">
                                      {item.finding.path}
                                    </p>
                                  )}
                                  {localized.displayRecommendation && (
                                    <p className="mt-1 text-slate-400">
                                      {localized.displayRecommendation}
                                    </p>
                                  )}
                                  <details className="mt-2 text-[10px] text-slate-500">
                                    <summary className="cursor-pointer text-slate-400">{t("schemaFindings.sourceEvidence")}</summary>
                                    <p className="mt-1 break-words font-mono">{localized.evidenceMessage}</p>
                                    {localized.evidenceRecommendation && <p className="mt-1 break-words">{localized.evidenceRecommendation}</p>}
                                  </details>
                                </li>;
                              },
                            )}
                          </ul>
                        </details>
                      ) : (
                        t("crawlDeepUi.noLocalFindings")
                      )}
                      {page.schema_validation_truncated && (
                        <p className="mt-1 text-[10px] text-amber-300">
                          {t("crawlDeepUi.validationLimitNote")}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </Table>
        ) : (
          <Empty>{t("crawlDeepUi.noStructuredData")}</Empty>
        );
};
