

import { cell, tableHead, optional } from './crawlResultsHelpers';
import { Table } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlContentTab = ({ session }: { session: Session }) => {
const { result, t } = session;
return (
          <Table minWidth="min-w-[1480px]">
            <caption className="caption-top p-3 text-left text-[11px] leading-5 text-slate-500">
              {t("crawl.ui.contentHeuristicNote")}
            </caption>
            <thead className={tableHead}>
              <tr>
                {[
                  t("crawl.ui.url"),
                  t("crawl.ui.title"),
                  t("crawl.ui.metaDescription"),
                  t("crawl.ui.words"),
                  t("crawl.ui.sentences"),
                  t("crawl.ui.textHtml"),
                  t("crawl.ui.complexity"),
                  t("crawl.ui.readability"),
                  t("crawl.ui.topTerms"),
                  t("crawl.ui.focusPhraseLabel"),
                  t("crawl.ui.language"),
                  t("crawl.ui.duplicateHeadings"),
                  t("crawl.ui.fingerprint"),
                ].map((label) => (
                  <th key={label} className={cell}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.pages.map((page) => (
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
                  <td
                    className={`${cell} max-w-48 truncate`}
                    title={page.title ?? undefined}
                  >
                    {page.title || "—"}
                  </td>
                  <td
                    className={`${cell} max-w-56 truncate`}
                    title={page.meta_description ?? undefined}
                  >
                    {page.meta_description || "—"}
                  </td>
                  <td className={`${cell} text-right font-mono`}>
                    {page.word_count}
                  </td>
                  <td className={`${cell} text-right font-mono`}>
                    {page.sentence_count ?? "—"}
                  </td>
                  <td className={`${cell} text-right font-mono`}>
                    {optional(page.text_ratio_percent)}
                    {page.text_ratio_percent != null ? "%" : ""}
                  </td>
                  <td className={`${cell} text-right font-mono`}>
                    {page.complexity_score == null
                      ? "—"
                      : `${page.complexity_score}/100`}
                    {page.complexity_label ? (
                      <span className="ml-1 text-[10px] text-slate-500">
                        {page.complexity_label}
                      </span>
                    ) : null}
                  </td>
                  <td
                    className={`${cell} text-right font-mono`}
                    title={
                      page.readability_method
                        ? `${t("crawl.ui.formula")}: ${page.readability_method}`
                        : undefined
                    }
                  >
                    {page.readability_ease_score == null
                      ? "—"
                      : `${page.readability_ease_score.toFixed(0)}/100`}
                    {page.readability_label ? (
                      <span className="ml-1 text-[10px] text-slate-500">
                        {page.readability_label}
                      </span>
                    ) : null}
                  </td>
                  <td className={`${cell} max-w-80 text-[11px]`}>
                    {page.content_terms?.length
                      ? page.content_terms
                          .slice(0, 8)
                          .map(
                            (term) =>
                              `${term.term} ${term.density_percent.toFixed(1)}%`,
                          )
                          .join(" · ")
                      : "—"}
                  </td>
                  <td className={`${cell} max-w-72 text-[11px]`}>
                    {page.focus_phrase
                      ? `${page.focus_phrase.phrase}: body ${page.focus_phrase.body_occurrences} (${page.focus_phrase.body_density_percent.toFixed(1)}%) · title ${page.focus_phrase.title_occurrences} · H1 ${page.focus_phrase.h1_occurrences}`
                      : "—"}
                  </td>
                  <td className={cell}>{page.document_language || "—"}</td>
                  <td className={`${cell} max-w-72`}>
                    {page.duplicate_headings?.length
                      ? page.duplicate_headings.map((heading, index) => (
                          <div
                            key={`${heading.text}-${index}`}
                            title={heading.text}
                          >
                            {heading.levels
                              .map((level) => `H${level}`)
                              .join("/")}{" "}
                            × {heading.occurrences}: {heading.text}
                          </div>
                        ))
                      : "—"}
                  </td>
                  <td className={`${cell} font-mono text-slate-500`}>
                    {page.content_hash
                      ? `${page.content_hash.slice(0, 12)}…${page.content_simhash ? ` / ${page.content_simhash}` : ""}`
                      : t("crawlDeepUi.noTextComparison")}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        );
};
