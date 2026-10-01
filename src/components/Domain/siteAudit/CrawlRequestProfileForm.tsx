import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlRequestProfileForm = ({ session }: { session: Session }) => {
const { requestProfileCookie, requestProfileHeaders, requestProfileName, requestProfileProxyUrl, setRequestProfileCookie, setRequestProfileHeaders, setRequestProfileName, setRequestProfileProxyUrl, t } = session;

return (<div className="mt-4 grid gap-3 border-t border-slate-800 pt-4 md:grid-cols-2">
            <label className="text-xs text-slate-400">
              {t("siteAudit.newProfileName")}
              <input
                value={requestProfileName}
                onChange={(event) => setRequestProfileName(event.target.value)}
                maxLength={80}
                placeholder={t("siteAudit.profileNamePlaceholder")}
                className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
              />
            </label>
            <label className="text-xs text-slate-400">
              {t("siteAudit.sessionCookies")}{" "}
              <span className="text-slate-600">{t("siteAudit.optional")}</span>
              <input
                type="password"
                value={requestProfileCookie}
                onChange={(event) =>
                  setRequestProfileCookie(event.target.value)
                }
                maxLength={16384}
                placeholder={t('siteAudit.sessionCookiesPlaceholder')}
                className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
              />
            </label>
            <label className="text-xs text-slate-400 md:col-span-2">
              {t("siteAudit.httpProxy")}{" "}
              <span className="text-slate-600">
                {t("siteAudit.proxyOptional")}
              </span>
              <input
                type="password"
                value={requestProfileProxyUrl}
                onChange={(event) =>
                  setRequestProfileProxyUrl(event.target.value)
                }
                maxLength={2048}
                placeholder={t('siteAudit.proxyUrlPlaceholder')}
                className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 font-mono text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
              />
            </label>
            <label className="text-xs text-slate-400 md:col-span-2">
              {t("siteAudit.customHeaders")}{" "}
              <span className="text-slate-600">
                {t("siteAudit.oneHeaderPerLine")}
              </span>
              <textarea
                value={requestProfileHeaders}
                onChange={(event) =>
                  setRequestProfileHeaders(event.target.value)
                }
                rows={3}
                placeholder={t('siteAudit.customHeadersPlaceholder')}
                className="mt-1.5 w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
              />
            </label>
          </div>);
};
