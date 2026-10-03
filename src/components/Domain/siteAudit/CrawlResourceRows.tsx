import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlResourceRows = ({ session }: { session: Session }) => {
const { filteredResources, t } = session;

return (<tbody>
                        {filteredResources.map((resource) => (
                          <tr
                            key={resource.url}
                            className="border-t border-slate-800/80 text-slate-300"
                          >
                            <td className="px-3 py-2 capitalize text-slate-400">
                              {resource.resource_type}
                            </td>
                            <td
                              className={`px-3 py-2 font-mono ${resource.http_status && resource.http_status < 400 ? "text-emerald-300" : "text-rose-300"}`}
                            >
                              {resource.http_status
                                ? t("crawl.ui.httpStatus", { status: resource.http_status })
                                : resource.request_error_kind ||
                                  t("siteAudit.requestError")}
                            </td>
                            <td
                              className="max-w-[360px] truncate px-3 py-2 font-mono"
                              title={resource.url}
                            >
                              {resource.url}
                            </td>
                            <td className="px-3 py-2 text-slate-500">
                              {resource.source_urls.length}
                            </td>
                            <td className="px-3 py-2 text-slate-500">
                              {resource.content_type || t("siteAudit.none")}{" "}
                              {resource.content_length !== undefined
                                ? ` · ${resource.content_length.toLocaleString()} B`
                                : ""}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-500">
                              {resource.intrinsic_width &&
                              resource.intrinsic_height
                                ? `${resource.intrinsic_width} × ${resource.intrinsic_height} · ${resource.dimensions_source || t("crawlDeepUi.intrinsic")}`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>);
};
