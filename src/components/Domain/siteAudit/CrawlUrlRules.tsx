import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlUrlRules = ({ session }: { session: Session }) => {
const { filterValidation, isCheckingFilters, t, validateFilters } = session;

return (<section className="p-4 pt-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                {t("siteAudit.urlRulesHeading")}
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                {t("siteAudit.urlRulesDescription")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void validateFilters()}
              disabled={isCheckingFilters}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-emerald-500/35 px-3 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10 disabled:cursor-wait disabled:opacity-60"
            >
              {isCheckingFilters
                ? t("siteAudit.checking")
                : t("siteAudit.checkRules")}
            </button>
          </div>
          {filterValidation && !filterValidation.valid && (
            <div className="mt-3 rounded-md border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              <p className="font-semibold">
                {t("siteAudit.invalidRulesBlock")}
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {filterValidation.errors.map((error, index) => (
                  <li key={`${error.filter}-${error.pattern}-${index}`}>
                    <span className="font-mono">
                      {error.filter}
                      {error.pattern ? `: ${error.pattern}` : ""}
                    </span>{" "}
                    — {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {filterValidation?.valid && (
            <div className="mt-3">
              <p className="text-xs text-emerald-300">
                {t("siteAudit.validRules")}{" "}
                {filterValidation.previews.length
                  ? t("siteAudit.previewChecked", {
                      count: filterValidation.previews.length,
                    })
                  : t("siteAudit.previewEmpty")}
              </p>
              {filterValidation.previews.length > 0 && (
                <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/60 text-xs">
                  {filterValidation.previews.map((preview) => (
                    <div
                      key={preview.url}
                      className="flex gap-2 border-b border-slate-800/80 px-3 py-2 last:border-b-0"
                    >
                      <span
                        className={`mt-0.5 shrink-0 font-semibold ${preview.included ? "text-emerald-300" : "text-amber-300"}`}
                      >
                        {preview.included
                          ? t("siteAudit.included")
                          : t("siteAudit.excluded")}
                      </span>
                      <span
                        className="min-w-0 flex-1 truncate font-mono text-slate-300"
                        title={preview.url}
                      >
                        {preview.url}
                      </span>
                      <span className="shrink-0 text-slate-500">
                        {preview.reason}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>);
};
