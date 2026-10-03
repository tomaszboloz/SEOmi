import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlComparisonDetails = ({ session }: { session: Session }) => {
const { comparison, t } = session;

if (!comparison) return null;
return (<div className="sm:col-span-3 max-h-52 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs">
                      {[
                        ...comparison.added,
                        ...comparison.removed,
                        ...comparison.changed,
                      ].length === 0 ? (
                        <p className="text-slate-500">
                          {t("siteAudit.comparisonNoDifferences")}
                        </p>
                      ) : (
                        [
                          ...comparison.added,
                          ...comparison.removed,
                          ...comparison.changed,
                        ].map((change) => (
                          <p
                            key={`${change.kind}-${change.url}`}
                            className="truncate py-1 text-slate-300"
                          >
                            <span
                              className={
                                change.kind === "added"
                                  ? "text-emerald-300"
                                  : change.kind === "removed"
                                    ? "text-rose-300"
                                    : "text-amber-300"
                              }
                            >
                              {change.kind === "added"
                                ? t("siteAudit.comparisonAddedLabel")
                                : change.kind === "removed"
                                  ? t("siteAudit.comparisonRemovedLabel")
                                  : t("siteAudit.comparisonChangedLabel")}
                            </span>{" "}
                            · {change.url}
                            {change.matchedUrl &&
                            change.matchedUrl !== change.url
                              ? ` ↔ ${change.matchedUrl}`
                              : ""}
                            {change.fields.length
                              ? ` (${change.fields.join(", ")})`
                              : ""}
                          </p>
                        ))
                      )}
                    </div>);
};
