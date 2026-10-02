import { localizeHtmlValidationFinding } from "@/services/htmlValidationLocalization";
import { cell, tableHead } from './crawlResultsHelpers';
import type { ValidationPageMatch } from './crawlValidationFilter';
import { Table } from './CrawlViewPrimitives';
import type { TFunction } from 'i18next';

export const CrawlValidationTable = ({ validationPages, t }: { validationPages: ValidationPageMatch[]; t: TFunction }) => (
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
);
