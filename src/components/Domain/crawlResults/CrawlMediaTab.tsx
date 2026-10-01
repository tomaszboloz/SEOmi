

import { ResourceProvenanceFilter, cell, tableHead, formatNumber } from './crawlResultsHelpers';
import { Empty, Table } from './CrawlViewPrimitives';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlMediaTab = ({ session }: { session: Session }) => {
const { resourceInventory, resourceProvenanceFilter, result, setResourceProvenanceFilter, t, visibleResourceInventory } = session;
{
        const images = result.pages.flatMap((page) =>
          page.images.map((image, index) => ({
            page,
            image,
            key: `${page.url}-${image.src}-${index}`,
          })),
        );
        return (
          <div className="space-y-6">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("crawl.ui.imagesCount", { count: images.length })}
              </h3>
              <p className="mb-2 text-[11px] text-slate-500">
                {t("crawl.ui.imagesDescription")}
              </p>
              {images.length ? (
                <Table minWidth="min-w-[1120px]">
                  <thead className={tableHead}>
                    <tr>
                      {[
                        t("crawl.ui.sourcePage"),
                        t("crawl.ui.imageSrcset"),
                        t("crawl.ui.httpStatusLabel"),
                        t("crawl.ui.bytes"),
                        t("crawl.ui.alt"),
                        t("crawl.ui.formatHint"),
                        t("crawl.ui.dimensionsSource"),
                        t("crawl.ui.loading"),
                      ].map((label) => (
                        <th key={label} className={cell}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {images.map(({ page, image, key }) => (
                      <tr
                        key={key}
                        className="border-t border-slate-800/80 align-top text-slate-300"
                      >
                        <td
                          className={`${cell} max-w-52 truncate font-mono`}
                          title={page.url}
                        >
                          {page.url}
                        </td>
                        <td
                          className={`${cell} max-w-72 font-mono`}
                          title={image.src}
                        >
                          <p className="truncate">{image.src}</p>
                          {image.srcset_resource_checks?.length ? (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-[10px] text-emerald-200">
                                {t("uiUnits.srcsetVariants", { count: image.srcset_resource_checks.length })}
                              </summary>
                              <ul className="mt-1 space-y-1">
                                {image.srcset_resource_checks.map(
                                  (candidate, index) => (
                                    <li
                                      key={`${candidate.url}-${index}`}
                                      className="break-all text-[10px]"
                                    >
                                      <span
                                        className={
                                          candidate.request_error_kind ||
                                          (candidate.http_status &&
                                            candidate.http_status >= 400)
                                            ? "text-rose-300"
                                            : candidate.checked_in_run
                                              ? "text-emerald-300"
                                              : "text-slate-500"
                                        }
                                      >
                                        {candidate.checked_in_run
                                          ? candidate.http_status
                                            ? t("crawl.ui.httpStatus", { status: candidate.http_status })
                                            : candidate.request_error_kind ||
                                              t("crawl.ui.checked")
                                          : t("crawl.ui.notChecked")}
                                      </span>
                                      {candidate.content_length == null
                                        ? ""
                                        : ` · ${formatNumber(candidate.content_length)} B`}{" "}
                                      · {candidate.url}
                                    </li>
                                  ),
                                )}
                              </ul>
                              {image.srcset_resource_checks_truncated && (
                                <p className="mt-1 text-amber-300">
                                  {t("crawl.ui.srcsetTruncated")}
                                </p>
                              )}
                            </details>
                          ) : (
                            image.srcset && (
                              <p
                                className="mt-1 truncate text-[10px] text-slate-500"
                                title={image.srcset}
                              >
                                {t("crawl.ui.srcsetNoVariants")}
                              </p>
                            )
                          )}
                        </td>
                        <td
                          className={`${cell} font-mono ${image.request_error_kind || (image.http_status && image.http_status >= 400) ? "text-rose-300" : image.checked_in_run ? "text-emerald-300" : "text-slate-500"}`}
                        >
                          {!image.checked_in_run
                            ? t("crawl.ui.notChecked")
                            : image.http_status
                              ? t("crawl.ui.httpStatus", { status: image.http_status })
                              : image.request_error_kind ||
                                t("crawl.ui.noStatus")}
                        </td>
                        <td className={`${cell} text-right font-mono`}>
                          {image.content_length === undefined ||
                          image.content_length === null
                            ? "—"
                            : `${formatNumber(image.content_length)} B`}
                        </td>
                        <td
                          className={`${cell} max-w-48 truncate ${image.alt === undefined ? "text-rose-300" : "text-slate-300"}`}
                        >
                          {image.alt === undefined
                            ? t("crawl.ui.missingAlt")
                            : image.alt || t("crawl.ui.emptyAlt")}
                        </td>
                        <td className={cell}>{image.format || "—"}</td>
                        <td className={`${cell} font-mono`}>
                          {image.width || "—"} × {image.height || "—"}
                          {image.dimensions_source && (
                            <span className="ml-1 text-[10px] text-slate-500">
                              ·{" "}
                              {t(
                                `crawl.ui.dimensionSources.${image.dimensions_source === "intrinsic-data-uri" ? "dataUri" : image.dimensions_source === "intrinsic-http" ? "http" : image.dimensions_source === "mixed" ? "mixed" : "attributes"}`,
                              )}
                            </span>
                          )}
                        </td>
                        <td className={cell}>
                          {image.lazy_loaded
                            ? t("crawl.ui.lazy")
                            : t("crawl.ui.standard")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <Empty>{t("crawl.ui.noImages")}</Empty>
              )}
            </section>
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t("crawl.ui.httpResources", {
                    visible: visibleResourceInventory.length,
                    total: resourceInventory.length,
                  })}
                </h3>
                {result.resource_limit_reached ? (
                  <span className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-200">
                    {t("siteAudit.resourceLimitReached")}
                  </span>
                ) : null}
                <div
                  className="flex flex-wrap gap-1"
                  role="group"
                  aria-label={t("crawl.ui.resourceProvenanceFilter")}
                >
                  {(
                    [
                      ["all", t("crawl.ui.all")],
                      ["orphaned", t("crawl.ui.orphaned")],
                      ["partial", t("crawl.ui.partialEvidence")],
                      ["unknown", t("crawl.ui.noEvidence")],
                    ] as Array<[ResourceProvenanceFilter, string]>
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={resourceProvenanceFilter === value}
                      onClick={() => setResourceProvenanceFilter(value)}
                      className={`rounded-md border px-2 py-1 text-[10px] transition ${resourceProvenanceFilter === value ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200" : "border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mb-2 text-[11px] text-slate-500">
                {t("crawlDeepUi.resourceTimingNote")}
              </p>
              {visibleResourceInventory.length > 0 ? (
                <Table minWidth="min-w-[980px]">
                  <thead className={tableHead}>
                    <tr>
                      {[
                        t("crawlDeepUi.resourceType"),
                        t("crawl.ui.status"),
                        t("crawl.ui.resource"),
                        t("crawl.ui.sources"),
                        t("siteAudit.contentType"),
                        t("crawl.ui.size"),
                        t("crawl.ui.intrinsicDimensions"),
                        t("crawl.ui.httpTime"),
                        t("crawl.ui.provenance"),
                      ].map((label) => (
                        <th key={label} className={cell}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleResourceInventory.map(
                      ({ resource, status, sourceUrls, knownSourceUrls }) => (
                        <tr
                          key={resource.url}
                          className="border-t border-slate-800/80 text-slate-300"
                        >
                          <td className={cell}>{resource.resource_type}</td>
                          <td
                            className={`${cell} font-mono ${resource.request_error_kind || (resource.http_status && resource.http_status >= 400) ? "text-rose-300" : "text-emerald-300"}`}
                          >
                            {resource.http_status
                          ? t("crawl.ui.httpStatus", { status: resource.http_status })
                              : resource.request_error_kind ||
                                t("crawlDeepUi.noStatus")}
                          </td>
                          <td
                            className={`${cell} max-w-72 truncate font-mono`}
                            title={resource.url}
                          >
                            {resource.url}
                          </td>
                          <td className={`${cell} text-right`}>
                            {sourceUrls.length}
                          </td>
                          <td className={cell}>
                            {resource.content_type || "—"}
                          </td>
                          <td className={`${cell} text-right font-mono`}>
                            {resource.content_length === undefined
                              ? "—"
                              : `${formatNumber(resource.content_length)} B`}
                          </td>
                          <td className={`${cell} text-right font-mono`}>
                            {resource.intrinsic_width &&
                            resource.intrinsic_height
                              ? `${resource.intrinsic_width} × ${resource.intrinsic_height} · ${resource.dimensions_source || t("crawlDeepUi.intrinsic")}`
                              : "—"}
                          </td>
                          <td className={`${cell} text-right font-mono`}>
                            {resource.response_time_ms === undefined
                              ? "—"
                              : `${resource.response_time_ms} ms`}
                          </td>
                          <td className={`${cell} max-w-56`}>
                            <span
                              className={
                                status === "orphaned"
                                  ? "text-rose-300"
                                  : status === "partial"
                                    ? "text-amber-300"
                                    : status === "unknown"
                                      ? "text-slate-500"
                                      : "text-emerald-300"
                              }
                              title={t("crawl.ui.resourceEvidenceTitle", {
                                sources: sourceUrls.length,
                                matched: knownSourceUrls.length,
                              })}
                            >
                              {t(`crawl.resources.provenance.${status}`)}
                            </span>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </Table>
              ) : (
                <Empty>
                  {resourceInventory.length > 0
                    ? t("crawl.ui.noResourcesForFilter")
                    : t("crawl.ui.noAdditionalResources")}
                </Empty>
              )}
            </section>
          </div>
        );
      }
};
