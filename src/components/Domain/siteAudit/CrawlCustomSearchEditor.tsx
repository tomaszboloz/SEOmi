import type { CustomSearchDefinition } from "@/types";

import type { useSiteAuditSession } from './useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
export const CrawlCustomSearchEditor = ({ session }: { session: Session }) => {
const { addCustomSearch, customSearches, setCrawlConfig, t, updateCustomSearch } = session;

return (<section className="space-y-3 px-4 pb-4">
          <p className="text-xs leading-5 text-slate-500">
            {t("crawl.customSearch.description")}
          </p>
          {customSearches.map((search) => (
            <div
              key={search.id}
              className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3 md:grid-cols-12"
            >
              <label className="text-[11px] text-slate-400 md:col-span-2">
                {t("crawl.customSearch.name")}
                <input
                  aria-label={`${t("crawl.customSearch.name")} ${search.name}`}
                  value={search.name}
                  maxLength={80}
                  onChange={(event) =>
                    updateCustomSearch(search.id, { name: event.target.value })
                  }
                  className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
                />
              </label>
              <label className="text-[11px] text-slate-400 md:col-span-2">
                {t("crawl.customSearch.selectorType")}
                <select
                  aria-label={`${t("crawl.customSearch.selectorType")} ${search.name}`}
                  value={search.selectorType}
                  onChange={(event) => {
                    const selectorType = event.target.value as CustomSearchDefinition["selectorType"];
                    updateCustomSearch(search.id, {
                      selectorType,
                      ...(selectorType === "regex"
                        ? { resultType: "text", attribute: undefined }
                        : {}),
                    });
                  }}
                  className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
                >
                  <option value="css">{t("crawl.customSearch.css")}</option>
                  <option value="xpath">{t("crawl.customSearch.xpath")}</option>
                  <option value="regex">{t("crawl.customSearch.regex")}</option>
                </select>
              </label>
              <label className="text-[11px] text-slate-400 md:col-span-4">
                {t("crawl.customSearch.selector")}
                <input
                  aria-label={`${t("crawl.customSearch.selector")} ${search.name}`}
                  value={search.query}
                  maxLength={512}
                  onChange={(event) =>
                    updateCustomSearch(search.id, { query: event.target.value })
                  }
                  placeholder={
                    search.selectorType === "css"
                      ? t("crawl.customSearch.cssPlaceholder")
                      : search.selectorType === "xpath"
                        ? t("crawl.customSearch.xpathPlaceholder")
                        : t("crawl.customSearch.regexPlaceholder")
                  }
                  className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 font-mono text-xs text-slate-200 outline-none focus:border-emerald-400"
                />
              </label>
              <label className="text-[11px] text-slate-400 md:col-span-2">
                {t("crawl.customSearch.resultType")}
                <select
                  aria-label={`${t("crawl.customSearch.resultType")} ${search.name}`}
                  value={search.selectorType === "regex" ? "text" : search.resultType}
                  disabled={search.selectorType === "regex"}
                  onChange={(event) =>
                    updateCustomSearch(search.id, {
                      resultType: event.target
                        .value as CustomSearchDefinition["resultType"],
                    })
                  }
                  className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
                >
                  <option value="text">{t("crawl.customSearch.text")}</option>
                  <option value="html">{t("crawl.customSearch.html")}</option>
                  <option value="attribute">{t("crawl.customSearch.attributeValue")}</option>
                </select>
              </label>
              {search.selectorType !== "regex" && search.resultType === "attribute" && (
                <label className="text-[11px] text-slate-400 md:col-span-1">
                  {t("crawl.customSearch.attribute")}
                  <input
                    aria-label={`${t("crawl.customSearch.attribute")} ${search.name}`}
                    value={search.attribute || ""}
                    maxLength={64}
                    onChange={(event) =>
                      updateCustomSearch(search.id, {
                        attribute: event.target.value,
                      })
                    }
                    placeholder={t('siteAudit.attributePlaceholder')}
                    className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 font-mono text-xs text-slate-200 outline-none focus:border-emerald-400"
                  />
                </label>
              )}
              <div className="flex items-end md:col-span-1">
                <button
                  type="button"
                  onClick={() =>
                    setCrawlConfig({
                      customSearches: customSearches.filter(
                        (item) => item.id !== search.id,
                      ),
                    })
                  }
                  className="h-8 w-full rounded-md border border-rose-500/25 px-2 text-xs text-rose-300 hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  {t("crawl.customSearch.remove")}
                </button>
              </div>
            </div>
          ))}
          {customSearches.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">
              {t("crawl.customSearch.empty")}
            </p>
          )}
          <button
            type="button"
            onClick={addCustomSearch}
            disabled={customSearches.length >= 10}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + {t("crawl.customSearch.add")}
          </button>
        </section>);
};
