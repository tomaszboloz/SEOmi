

import { metadataFacetOptions, cell, tableHead } from './crawlResultsHelpers';
import { Empty, Table } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlMetadataTab = ({ session }: { session: Session }) => {
const { filteredMetadataRows, localizedFacetDescription, localizedFacetLabel, metadataFacet, metadataFacetCounts, metadataRows, setMetadataFacet, t } = session;
return (
          <div className="space-y-4">
            <section
              aria-label={t("crawl.ui.metadataFilters")}
              className="rounded-lg border border-slate-800 bg-slate-950/45 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    {t("crawl.ui.metadataReport")}
                  </h3>
                  <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">
                    {t("crawl.ui.metadataDescription")}
                  </p>
                </div>
                <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300">
                  {t("crawl.ui.urlCount", {
                    visible: filteredMetadataRows.length,
                    total: metadataRows.length,
                  })}
                </span>
              </div>
              <div
                className="mt-3 flex flex-wrap gap-1.5"
                role="group"
                aria-label={t("crawl.ui.metadataIssueFilter")}
              >
                {metadataFacetOptions.map((facet) => {
                  const selected = metadataFacet === facet.id;
                  return (
                    <button
                      key={facet.id}
                      type="button"
                      aria-pressed={selected}
                      title={localizedFacetDescription(facet)}
                      onClick={() => setMetadataFacet(facet.id)}
                      className={`rounded-md border px-2.5 py-1.5 text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${selected ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-100" : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}
                    >
                      {localizedFacetLabel(facet)} ·{" "}
                      {metadataFacetCounts[facet.id]}
                    </button>
                  );
                })}
              </div>
            </section>
            {filteredMetadataRows.length ? (
              <Table minWidth="min-w-[1040px]">
                <thead className={tableHead}>
                  <tr>
                    <th className={cell}>{t("crawl.ui.url")}</th>
                    <th className={cell}>{t("crawl.ui.title")}</th>
                    <th className={cell}>{t("crawl.ui.titleCharacters")}</th>
                    <th className={cell}>{t("crawl.ui.metaDescription")}</th>
                    <th className={cell}>
                      {t("crawl.ui.descriptionCharacters")}
                    </th>
                    <th className={cell}>{t("crawl.ui.signals")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMetadataRows.map(({ page, facets }) => (
                    <tr
                      key={page.url}
                      className="border-t border-slate-800/80 text-slate-300"
                    >
                      <td className={`${cell} max-w-72 break-all font-mono`}>
                        {page.url}
                      </td>
                      <td className={`${cell} max-w-64 break-words`}>
                        {typeof page.title !== "string"
                          ? t("crawl.ui.missingTag")
                          : page.title || t("crawl.ui.emptyValue")}
                      </td>
                      <td className={`${cell} whitespace-nowrap font-mono`}>
                        {page.title_length ??
                          (typeof page.title !== "string"
                            ? "—"
                            : page.title.trim().length)}
                      </td>
                      <td className={`${cell} max-w-72 break-words`}>
                        {typeof page.meta_description !== "string"
                          ? t("crawl.ui.missingTagOrData")
                          : page.meta_description || t("crawl.ui.emptyValue")}
                      </td>
                      <td className={`${cell} whitespace-nowrap font-mono`}>
                        {page.meta_description_length ??
                          (typeof page.meta_description !== "string"
                            ? "—"
                            : page.meta_description.trim().length)}
                      </td>
                      <td className={`${cell} max-w-80`}>
                        {facets.length ? (
                          <div className="flex flex-wrap gap-1">
                            {facets.map((facetId) => (
                              <span
                                key={facetId}
                                className="rounded border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-[10px] text-amber-200"
                              >
                                {metadataFacetOptions.find(
                                  (facet) => facet.id === facetId,
                                ) &&
                                  localizedFacetLabel(
                                    metadataFacetOptions.find(
                                      (facet) => facet.id === facetId,
                                    )!,
                                  )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-emerald-300">
                            {t("crawl.ui.noSignals")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Empty>{t("crawl.ui.noUrlsForMetadata")}</Empty>
            )}
          </div>
        );
};
