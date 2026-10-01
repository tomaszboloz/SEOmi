import type { useSiteAuditSession } from './useSiteAuditSession';
import { CrawlRenderOptions } from './CrawlRenderOptions';
type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlConfigurationForm = ({ session }: { session: Session }) => {
const { crawlConfig, importSeedUrls, seedImportRejected, setAllowedHosts, setCrawlConfig, setFilterPatterns, setQueryParameterNames, t } = session;

return (<section className="grid gap-3 px-4 pb-4 md:grid-cols-3">
          {crawlConfig.crawlMode === "browser-rendered" && (
            <CrawlRenderOptions session={session} />
          )}
          <label className="text-xs text-slate-400">
            {t("siteAudit.maxDepth")}{" "}
            <span className="text-slate-600">
              {t("siteAudit.emptyNoLimit")}
            </span>
            <input
              type="number"
              min="0"
              max="100"
              value={crawlConfig.maxDepth ?? ""}
              onChange={(event) =>
                setCrawlConfig({
                  maxDepth:
                    event.target.value === ""
                      ? undefined
                      : Number(event.target.value),
                })
              }
              className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-emerald-400"
            />
          </label>
          <label className="text-xs text-slate-400">
            {t("siteAudit.maxRedirects")}
            <input
              type="number"
              min="0"
              max="50"
              value={crawlConfig.maxRedirects ?? 10}
              onChange={(event) =>
                setCrawlConfig({ maxRedirects: Number(event.target.value) })
              }
              className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-emerald-400"
            />
          </label>
          <label className="text-xs text-slate-400">
            {t("siteAudit.maxResponse")}
            <input
              type="number"
              min="1"
              max="50"
              value={Math.round(
                (crawlConfig.maxResponseBytes ?? 5_000_000) / 1_000_000,
              )}
              onChange={(event) =>
                setCrawlConfig({
                  maxResponseBytes: Number(event.target.value) * 1_000_000,
                })
              }
              className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-emerald-400"
            />
          </label>
          <label className="text-xs text-slate-400">
            {t("siteAudit.maxRunTime")}
            <input
              type="number"
              min="1"
              max="3600"
              value={crawlConfig.maxRunSeconds ?? ""}
              onChange={(event) =>
                setCrawlConfig({
                  maxRunSeconds:
                    event.target.value === ""
                      ? undefined
                      : Number(event.target.value),
                })
              }
              className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-emerald-400"
            />
          </label>
          <label className="text-xs text-slate-400">
            {t("siteAudit.includeUrl")}
            <textarea
              value={crawlConfig.includePatterns.join("\n")}
              onChange={(event) =>
                setFilterPatterns("includePatterns", event.target.value)
              }
              placeholder={t('siteAudit.includeUrlPlaceholder')}
              rows={2}
              className="mt-1.5 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
            />
          </label>
          <label className="text-xs text-slate-400">
            {t("siteAudit.excludeUrl")}
            <textarea
              value={crawlConfig.excludePatterns.join("\n")}
              onChange={(event) =>
                setFilterPatterns("excludePatterns", event.target.value)
              }
              placeholder={t('siteAudit.excludeUrlPlaceholder')}
              rows={2}
              className="mt-1.5 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={crawlConfig.allowSubdomains}
              onChange={(event) =>
                setCrawlConfig({ allowSubdomains: event.target.checked })
              }
              className="accent-emerald-400"
            />
            {t("siteAudit.includeSubdomains")}
          </label>
          <label className="text-xs text-slate-400">
            {t("siteAudit.allowedHosts")}{" "}
            <span className="text-slate-600">
              {t("siteAudit.explicitOnePerLine")}
            </span>
            <textarea
              value={(crawlConfig.allowedHosts || []).join("\n")}
              onChange={(event) => setAllowedHosts(event.target.value)}
              placeholder={t('siteAudit.allowedHostsPlaceholder')}
              rows={2}
              className="mt-1.5 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
            />
          </label>
          <label className="text-xs text-slate-400">
            {t("siteAudit.scopeDirectory")}{" "}
            <span className="text-slate-600">{t("siteAudit.optional")}</span>
            <input
              value={crawlConfig.scopePath ?? ""}
              onChange={(event) =>
                setCrawlConfig({ scopePath: event.target.value || undefined })
              }
              placeholder={t('siteAudit.scopeDirectoryPlaceholder')}
              className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={crawlConfig.keepQueryStrings}
              onChange={(event) =>
                setCrawlConfig({ keepQueryStrings: event.target.checked })
              }
              className="accent-emerald-400"
            />
            {t("siteAudit.keepQueryStrings")}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(crawlConfig.trimTrailingSlash)}
              onChange={(event) =>
                setCrawlConfig({ trimTrailingSlash: event.target.checked })
              }
              className="accent-emerald-400"
            />
            {t("siteAudit.trimTrailingSlash")}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(crawlConfig.lowercasePath)}
              onChange={(event) =>
                setCrawlConfig({ lowercasePath: event.target.checked })
              }
              className="accent-emerald-400"
            />
            {t("siteAudit.lowercasePath")}
          </label>
          {crawlConfig.keepQueryStrings && (
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(crawlConfig.stripTrackingParameters)}
                onChange={(event) =>
                  setCrawlConfig({
                    stripTrackingParameters: event.target.checked,
                  })
                }
                className="accent-emerald-400"
              />
              {t("siteAudit.stripTracking")}
            </label>
          )}
          {crawlConfig.keepQueryStrings && (
            <label className="text-xs text-slate-400">
              {t("siteAudit.allowedQueryNames")}{" "}
              <span className="text-slate-600">
                {t("siteAudit.optionalCommaLine")}
              </span>
              <textarea
                value={(crawlConfig.allowedQueryParameters || []).join("\n")}
                onChange={(event) =>
                  setQueryParameterNames(
                    "allowedQueryParameters",
                    event.target.value,
                  )
                }
                placeholder={t('siteAudit.pageExcludePlaceholder')}
                rows={2}
                className="mt-1.5 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
              />
            </label>
          )}
          {crawlConfig.keepQueryStrings && (
            <label className="text-xs text-slate-400">
              {t("siteAudit.deniedQueryNames")}{" "}
              <span className="text-slate-600">{t("siteAudit.denyFirst")}</span>
              <textarea
                value={(crawlConfig.deniedQueryParameters || []).join("\n")}
                onChange={(event) =>
                  setQueryParameterNames(
                    "deniedQueryParameters",
                    event.target.value,
                  )
                }
                placeholder={t('siteAudit.queryExcludePlaceholder')}
                rows={2}
                className="mt-1.5 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
              />
            </label>
          )}
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={crawlConfig.respectRobots}
              onChange={(event) =>
                setCrawlConfig({ respectRobots: event.target.checked })
              }
              className="accent-emerald-400"
            />
            {t("siteAudit.respectRobots")}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={crawlConfig.respectCrawlDelay}
              onChange={(event) =>
                setCrawlConfig({ respectCrawlDelay: event.target.checked })
              }
              disabled={!crawlConfig.respectRobots}
              className="accent-emerald-400 disabled:opacity-40"
            />
            {t("siteAudit.respectCrawlDelay")}{" "}
            <span className="text-slate-600">
              {t("siteAudit.max60Seconds")}
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={crawlConfig.discoverSitemaps}
              onChange={(event) =>
                setCrawlConfig({ discoverSitemaps: event.target.checked })
              }
              className="accent-emerald-400"
            />
            {t("siteAudit.discoverSitemaps")}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={crawlConfig.followNofollow}
              onChange={(event) =>
                setCrawlConfig({ followNofollow: event.target.checked })
              }
              className="accent-emerald-400"
            />
            {t("siteAudit.followNofollow")}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(crawlConfig.listMode)}
              onChange={(event) =>
                setCrawlConfig({ listMode: event.target.checked })
              }
              className="accent-emerald-400"
            />
            {t("siteAudit.listMode")}
          </label>
          <label className="text-xs text-slate-400">
            {t("siteAudit.focusPhrase")}{" "}
            <span className="text-slate-600">
              {t("siteAudit.optionalEvidence")}
            </span>
            <input
              aria-label={t("siteAudit.focusPhraseAria")}
              value={crawlConfig.focusPhrase || ""}
              maxLength={160}
              onChange={(event) =>
                setCrawlConfig({ focusPhrase: event.target.value })
              }
              placeholder={t("siteAudit.focusPhrasePlaceholder")}
              className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(crawlConfig.crawlImages)}
              onChange={(event) =>
                setCrawlConfig({ crawlImages: event.target.checked })
              }
              className="accent-emerald-400"
            />
            {t("siteAudit.crawlImages")}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(crawlConfig.crawlStylesheets)}
              onChange={(event) =>
                setCrawlConfig({ crawlStylesheets: event.target.checked })
              }
              className="accent-emerald-400"
            />
            {t("siteAudit.crawlStylesheets")}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(crawlConfig.crawlScripts)}
              onChange={(event) =>
                setCrawlConfig({ crawlScripts: event.target.checked })
              }
              className="accent-emerald-400"
            />
            {t("siteAudit.crawlScripts")}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(crawlConfig.crawlOtherResources)}
              onChange={(event) =>
                setCrawlConfig({ crawlOtherResources: event.target.checked })
              }
              className="accent-emerald-400"
            />
            {t("siteAudit.crawlOtherResources")}
          </label>
          {(crawlConfig.crawlImages ||
            crawlConfig.crawlStylesheets ||
            crawlConfig.crawlScripts ||
            crawlConfig.crawlOtherResources) && (
            <>
              <label className="text-xs text-slate-400">
                {t("siteAudit.maxResources")}{" "}
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={crawlConfig.maxResourceRequests ?? 250}
                  onChange={(event) =>
                    setCrawlConfig({
                      maxResourceRequests: Number(event.target.value),
                    })
                  }
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-emerald-400"
                />
              </label>
              <label className="text-xs text-slate-400">
                {t("siteAudit.resourceConcurrency")}{" "}
                <span className="text-slate-600">
                  {t("siteAudit.httpRequests")}
                </span>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={crawlConfig.maxConcurrentRequests ?? 4}
                  onChange={(event) =>
                    setCrawlConfig({
                      maxConcurrentRequests: Math.min(
                        16,
                        Math.max(1, Number(event.target.value) || 1),
                      ),
                    })
                  }
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-emerald-400"
                />
              </label>
            </>
          )}
          <label className="text-xs text-slate-400">
            {t("siteAudit.importCsv")}{" "}
            <span className="text-slate-600">
              {t("siteAudit.csvColumnLimit")}
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void importSeedUrls(event.target.files?.[0])}
              className="mt-1.5 block w-full text-xs text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-xs file:text-slate-200"
            />
            {crawlConfig.seedUrls?.length ? (
              <span className="mt-1 block text-[11px] text-emerald-300">
                {t("siteAudit.urlsLoaded", {
                  count: crawlConfig.seedUrls.length,
                })}
              </span>
            ) : null}
            {seedImportRejected.length ? (
              <span className="mt-1 block text-[11px] text-amber-300">
                {t("siteAudit.rowsRejected", {
                  count: seedImportRejected.length,
                })}
              </span>
            ) : null}
          </label>
          <p className="text-xs leading-5 text-slate-500">
            {t("siteAudit.normalizationNotice")}
          </p>
        </section>);
};
