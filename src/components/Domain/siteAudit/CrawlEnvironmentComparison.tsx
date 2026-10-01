import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlEnvironmentComparison = ({ session }: { session: Session }) => {
const { desktopAvailable, environmentComparisonError, environmentUrls, isCrawling, isEnvironmentComparisonRunning, runEnvironmentComparison, t, updateEnvironmentUrl } = session;

return (<section className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                {t("siteAudit.environmentComparisonTitle")}
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
                {t("siteAudit.environmentComparisonDescription")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void runEnvironmentComparison()}
              disabled={
                isEnvironmentComparisonRunning ||
                isCrawling ||
                !desktopAvailable ||
                !environmentUrls.staging.trim() ||
                !environmentUrls.production.trim()
              }
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-sky-600 px-3 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isEnvironmentComparisonRunning
                ? t("siteAudit.environmentComparisonRunning")
                : t("siteAudit.environmentComparisonRun")}
            </button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-300">
              {t("siteAudit.environmentStagingUrl")}
              <input
                value={environmentUrls.staging}
                onChange={(event) =>
                  updateEnvironmentUrl("staging", event.target.value)
                }
                placeholder={t("siteAudit.environmentStagingPlaceholder")}
                className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950/80 px-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>
            <label className="text-xs text-slate-300">
              {t("siteAudit.environmentProductionUrl")}
              <input
                value={environmentUrls.production}
                onChange={(event) =>
                  updateEnvironmentUrl("production", event.target.value)
                }
                placeholder={t("siteAudit.environmentProductionPlaceholder")}
                className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950/80 px-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400"
              />
            </label>
          </div>
          {environmentComparisonError && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100"
            >
              {environmentComparisonError}
            </p>
          )}
          <p className="mt-3 text-[11px] leading-5 text-slate-500">
            {t("siteAudit.environmentComparisonNotice")}
          </p>
        </section>);
};
