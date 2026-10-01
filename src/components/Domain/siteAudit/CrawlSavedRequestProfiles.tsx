import type { useSiteAuditSession } from './useSiteAuditSession';
import { CrawlRequestProfileForm } from './CrawlRequestProfileForm';
type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlSavedRequestProfiles = ({ session }: { session: Session }) => {
const { crawlConfig, crawlRequestProfiles, isSavingCrawlRequestProfile, removeRequestProfile, requestProfileStatus, requestProfileStatusIsError, saveRequestProfile, selectRequestProfile, setCrawlConfig, t } = session;

return (<section className="p-4 pt-0">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-slate-100">
              {t("siteAudit.requestProfileHeading")}
            </h2>
            <p className="text-xs leading-5 text-slate-500">
              {t("siteAudit.requestProfileDescription")}
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-400">
              {t("siteAudit.activeProfile")}
              <select
                value={crawlConfig.requestProfileId || ""}
                onChange={(event) => selectRequestProfile(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-emerald-400"
              >
                <option value="">{t("siteAudit.noProfile")}</option>
                {crawlRequestProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                    {profile.hasCookie ? ` · ${t("siteAudit.cookies")}` : ""}
                    {profile.hasHeaders ? ` · ${t("siteAudit.headers")}` : ""}
                    {profile.hasProxy ? ` · ${t("siteAudit.proxy")}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              {t("urlBar.userAgent")}
              <input
                value={crawlConfig.userAgent || ""}
                onChange={(event) =>
                  setCrawlConfig({ userAgent: event.target.value })
                }
                maxLength={1024}
                placeholder={t("siteAudit.userAgentPlaceholder")}
                className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
              />
            </label>
          </div>
          {crawlConfig.requestProfileId && (
            <button
              type="button"
              onClick={() => void removeRequestProfile()}
              className="mt-3 text-xs font-medium text-rose-300 underline decoration-rose-500/40 underline-offset-4 hover:text-rose-200"
            >
              {t("siteAudit.removeProfile")}
            </button>
          )}
          <CrawlRequestProfileForm session={session} />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void saveRequestProfile()}
              disabled={isSavingCrawlRequestProfile}
              className="inline-flex h-9 items-center rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/15 disabled:cursor-wait disabled:opacity-60"
            >
              {isSavingCrawlRequestProfile
                ? t("siteAudit.saving")
                : t("siteAudit.saveProfile")}
            </button>
            <p className="text-[11px] text-slate-500">
              {t("siteAudit.profileSecretsNotice")}
            </p>
          </div>
          {requestProfileStatus && (
            <p
              className={`mt-3 rounded-md border px-3 py-2 text-xs ${requestProfileStatusIsError ? "border-rose-500/35 bg-rose-500/10 text-rose-100" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"}`}
            >
              {requestProfileStatus}
            </p>
          )}
        </section>);
};
