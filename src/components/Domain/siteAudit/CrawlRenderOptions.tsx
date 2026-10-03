import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlRenderOptions = ({ session }: { session: Session }) => {
const { crawlConfig, renderedProfileHasTransportOverrides, setCrawlConfig, t } = session;

return (<>
              <label className="text-xs text-slate-400">
                {t("siteAudit.renderWaitSelector")}{" "}
                <span className="text-slate-600">
                  {t("siteAudit.optionalMaxSeconds", { count: 8 })}
                </span>
                <input
                  aria-label={t("siteAudit.renderWaitSelectorAria")}
                  value={crawlConfig.renderWaitForSelector || ""}
                  maxLength={512}
                  onChange={(event) =>
                    setCrawlConfig({
                      renderWaitForSelector: event.target.value,
                    })
                  }
                  placeholder={t("siteAudit.renderWaitSelectorPlaceholder")}
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
                />
              </label>
              <label className="text-xs text-slate-400">
                {t("siteAudit.renderDelay")}
                <input
                  aria-label={t("siteAudit.renderDelayAria")}
                  type="number"
                  min="0"
                  max="10000"
                  step="100"
                  value={crawlConfig.renderWaitDelayMs ?? 0}
                  onChange={(event) =>
                    setCrawlConfig({
                      renderWaitDelayMs: Math.min(
                        10000,
                        Math.max(0, Number(event.target.value) || 0),
                      ),
                    })
                  }
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-emerald-400"
                />
              </label>
              <label className="text-xs text-slate-400">
                {t("siteAudit.lazyScroll")}
                <input
                  aria-label={t("siteAudit.lazyScrollAria")}
                  type="number"
                  min="0"
                  max="40"
                  value={crawlConfig.renderLazyScrollCycles ?? 0}
                  onChange={(event) =>
                    setCrawlConfig({
                      renderLazyScrollCycles: Math.min(
                        40,
                        Math.max(0, Number(event.target.value) || 0),
                      ),
                    })
                  }
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-emerald-400"
                />
              </label>
              <p className="text-xs leading-5 text-slate-500 md:col-span-3">
                {t("siteAudit.browserModeNotice")}
              </p>
              {crawlConfig.requestProfileId &&
                renderedProfileHasTransportOverrides && (
                  <p
                    role="alert"
                    className="text-xs text-amber-200 md:col-span-3"
                  >
                    {t("siteAudit.renderProfileWarning")}
                  </p>
                )}
            </>);
};
