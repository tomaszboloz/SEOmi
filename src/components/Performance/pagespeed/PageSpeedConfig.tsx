import React from "react";
import { useTranslation } from "react-i18next";
import { Activity, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { CruxFormFactor, PageSpeedStrategy } from "@/services/pagespeed";

interface PageSpeedConfigProps {
  session: {
    url: string;
    strategy: PageSpeedStrategy;
    formFactor: CruxFormFactor;
    scope: "url" | "origin";
  };
  updateSession: (updates: Partial<{
    url: string;
    strategy: PageSpeedStrategy;
    formFactor: CruxFormFactor;
    scope: "url" | "origin";
    pageSpeed: any;
    crux: any;
  }>) => void;
  isRunningPsi: boolean;
  isRunningCrux: boolean;
  psiError: string | null;
  cruxError: string | null;
  runPsi: () => Promise<void>;
  runCrux: () => Promise<void>;
  hasApiKey: boolean;
}

export const PageSpeedConfig: React.FC<PageSpeedConfigProps> = ({
  session, updateSession, isRunningPsi, isRunningCrux, psiError, cruxError, runPsi, runCrux, hasApiKey,
}) => {
  const { t } = useTranslation();
  return (
    <>
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300">
          <Activity className="h-3.5 w-3.5" /> {t("pageSpeedUi.badge")}
        </div>
        <h1 className="text-2xl font-bold text-white">{t("pageSpeedUi.title")}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{t("pageSpeedUi.description")}</p>
      </header>

      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <label className="grid gap-1.5 text-xs text-slate-400">
          {t("pageSpeedUi.urlLabel")}
          <input
            value={session.url}
            onChange={(e) => updateSession({ url: e.target.value, pageSpeed: null, crux: null })}
            placeholder={t("pageSpeedUi.urlPlaceholder")}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs text-slate-400">
            {t("pageSpeedUi.pageSpeedDevice")}
            <select
              value={session.strategy}
              onChange={(e) => updateSession({ strategy: e.target.value as PageSpeedStrategy, pageSpeed: null })}
              className="min-w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            >
              <option value="mobile">{t("pageSpeedUi.mobile")}</option>
              <option value="desktop">{t("pageSpeedUi.desktop")}</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">
            {t("pageSpeedUi.cruxDevice")}
            <select
              value={session.formFactor}
              onChange={(e) => updateSession({ formFactor: e.target.value as CruxFormFactor, crux: null })}
              className="min-w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            >
              <option value="PHONE">{t("pageSpeedUi.phone")}</option>
              <option value="DESKTOP">{t("pageSpeedUi.desktop")}</option>
              <option value="TABLET">{t("pageSpeedUi.tablet")}</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">
            {t("pageSpeedUi.cruxScope")}
            <select
              value={session.scope}
              onChange={(e) => updateSession({ scope: e.target.value as "url" | "origin", crux: null })}
              className="min-w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            >
              <option value="url">{t("pageSpeedUi.exactUrl")}</option>
              <option value="origin">{t("pageSpeedUi.wholeOrigin")}</option>
            </select>
          </label>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button" onClick={() => void runCrux()} disabled={isRunningCrux}
              className="inline-flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-50"
            >
              {isRunningCrux ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {isRunningCrux ? t("pageSpeedUi.fetchingCrux") : t("pageSpeedUi.fetchFieldData")}
            </button>
            <button
              type="button" onClick={() => void runPsi()} disabled={isRunningPsi}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isRunningPsi ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {isRunningPsi ? t("pageSpeedUi.runningLighthouse") : t("pageSpeedUi.runPageSpeed")}
            </button>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p>{t("pageSpeedUi.apiNotice")}</p>
        </div>
        <p className={`text-xs ${hasApiKey ? "text-emerald-300" : "text-amber-300"}`}>
          {hasApiKey ? t("pageSpeedUi.apiConfigured") : t("pageSpeedUi.apiMissing")}
        </p>
        {psiError && (
          <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-3 text-sm text-rose-300">
            {t("pageSpeedUi.psiPrefix")}: {psiError}
          </div>
        )}
        {cruxError && (
          <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-3 text-sm text-rose-300">
            {t("pageSpeedUi.cruxPrefix")}: {cruxError}
          </div>
        )}
      </section>
    </>
  );
};
