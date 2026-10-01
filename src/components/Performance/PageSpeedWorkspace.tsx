import React from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  CruxFormFactor,
  PageSpeedStrategy,
} from "@/services/pagespeed";
import { TrendChart } from "@/components/Charts/TrendChart";
import {
  clearPageSpeedSnapshots,
  comparePageSpeedSnapshots,
  pageSpeedHistoryCsv,
} from "@/services/pagespeedHistory";
import { downloadText } from "@/services/export";
import { PSI_METRICS } from './performanceSession';
import { usePerformanceWorkspace } from './usePerformanceWorkspace';
import { scoreColor, formatBytes, formatDelta } from './performanceFormatting';
import { readCruxMetrics, formatCruxValue, cruxCategory, formatCruxCollectionPeriod } from './cruxEvidence';

const renderLighthouseDescription = (description: string): React.ReactNode => {
  const parts = description.split(/(\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    return match
      ? <a key={index} href={match[2]} target="_blank" rel="noreferrer" className="text-sky-300 underline underline-offset-2">{match[1]}</a>
      : <React.Fragment key={index}>{part}</React.Fragment>;
  });
};

export const PageSpeedWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const project = useProjectStore((state) =>
    state.projects.find((item) => item.id === state.activeProjectId),
  );
  const hasApiKey = Boolean(
    useSettingsStore((state) => state.googleMetricsApiKey),
  );
  const { session, updateSession, isRunningPsi, isRunningCrux, psiError, cruxError,
    history, setHistory, compareId, setCompareId, runPsi, runCrux } = usePerformanceWorkspace(activeProjectId, project?.rootUrl || "", t);
  const cruxMetrics = readCruxMetrics(session.crux?.response);
  const collectionPeriod = formatCruxCollectionPeriod(session.crux?.response);

  const psiReport = session.pageSpeed;
  const chronologicalHistory = [...history].sort((a, b) =>
    a.capturedAt.localeCompare(b.capturedAt),
  );
  const latestSnapshot = history[0] || null;
  const baselineSnapshot =
    history.find((item) => item.id === compareId) || null;
  const comparison =
    baselineSnapshot &&
    latestSnapshot &&
    baselineSnapshot.id !== latestSnapshot.id
      ? comparePageSpeedSnapshots(baselineSnapshot, latestSnapshot)
      : null;
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300">
          <Activity className="h-3.5 w-3.5" /> {t("pageSpeedUi.badge")}
        </div>
        <h1 className="text-2xl font-bold text-white">
          {t("pageSpeedUi.title")}
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
          {t("pageSpeedUi.description")}
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <label className="grid gap-1.5 text-xs text-slate-400">
          {t("pageSpeedUi.urlLabel")}
          <input
            value={session.url}
            onChange={(event) =>
              updateSession({
                url: event.target.value,
                pageSpeed: null,
                crux: null,
              })
            }
            placeholder={t("pageSpeedUi.urlPlaceholder")}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs text-slate-400">
            {t("pageSpeedUi.pageSpeedDevice")}
            <select
              value={session.strategy}
              onChange={(event) =>
                updateSession({
                  strategy: event.target.value as PageSpeedStrategy,
                  pageSpeed: null,
                })
              }
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
              onChange={(event) =>
                updateSession({
                  formFactor: event.target.value as CruxFormFactor,
                  crux: null,
                })
              }
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
              onChange={(event) =>
                updateSession({
                  scope: event.target.value as "url" | "origin",
                  crux: null,
                })
              }
              className="min-w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            >
              <option value="url">{t("pageSpeedUi.exactUrl")}</option>
              <option value="origin">{t("pageSpeedUi.wholeOrigin")}</option>
            </select>
          </label>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runCrux()}
              disabled={isRunningCrux}
              className="inline-flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-50"
            >
              {isRunningCrux ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}{" "}
              {isRunningCrux
                ? t("pageSpeedUi.fetchingCrux")
                : t("pageSpeedUi.fetchFieldData")}
            </button>
            <button
              type="button"
              onClick={() => void runPsi()}
              disabled={isRunningPsi}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isRunningPsi ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}{" "}
              {isRunningPsi
                ? t("pageSpeedUi.runningLighthouse")
                : t("pageSpeedUi.runPageSpeed")}
            </button>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p>{t("pageSpeedUi.apiNotice")}</p>
        </div>
        <p
          className={`text-xs ${hasApiKey ? "text-emerald-300" : "text-amber-300"}`}
        >
          {hasApiKey
            ? t("pageSpeedUi.apiConfigured")
            : t("pageSpeedUi.apiMissing")}
        </p>
        {psiError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-3 text-sm text-rose-300"
          >
            {t("pageSpeedUi.psiPrefix")}: {psiError}
          </div>
        )}
        {cruxError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-3 text-sm text-rose-300"
          >
            {t("pageSpeedUi.cruxPrefix")}: {cruxError}
          </div>
        )}
      </section>

      <section
        className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5"
        aria-label={t("pageSpeedUi.historyAria")}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-sky-300" />
              <h2 className="text-sm font-semibold text-white">
                {t("pageSpeedUi.historyTitle")}
              </h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {t("pageSpeedUi.historyDescription")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                downloadText(
                  `seomi-pagespeed-history-${activeProjectId || "project"}.csv`,
                  pageSpeedHistoryCsv(history),
                  "text/csv",
                )
              }
              disabled={history.length === 0}
              className="rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("pageSpeedUi.exportCsv")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t("pageSpeedUi.clearConfirm"))) {
                  clearPageSpeedSnapshots(activeProjectId);
                  setHistory([]);
                  setCompareId("");
                }
              }}
              disabled={history.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 px-2.5 py-1.5 text-[11px] text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("pageSpeedUi.clearHistory")}
            </button>
          </div>
        </div>
        {history.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-500">
            {t("pageSpeedUi.noSnapshots")}
          </p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  "performance",
                  "accessibility",
                  "bestPractices",
                  "seo",
                ] as const
              ).map((key) => (
                <article
                  key={key}
                  className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {t(`pageSpeedUi.categories.${key}`)}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {t("pageSpeedUi.points", {
                        count: chronologicalHistory.length,
                      })}
                    </span>
                  </div>
                  <TrendChart
                    values={chronologicalHistory.map(
                      (snapshot) => snapshot.pageSpeed?.categories[key] ?? null,
                    )}
                    label={t("pageSpeedUi.trendAria", {
                      metric: t(`pageSpeedUi.categories.${key}`),
                    })}
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                    <span>
                      {chronologicalHistory[0]?.pageSpeed?.categories[key] ??
                        "—"}
                    </span>
                    <span>
                      {latestSnapshot?.pageSpeed?.categories[key] ?? "—"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <label className="grid min-w-64 gap-1 text-[11px] text-slate-400">
                {t("pageSpeedUi.baselineLabel")}
                <select
                  aria-label={t("pageSpeedUi.baselineAria")}
                  value={compareId}
                  onChange={(event) => setCompareId(event.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-200"
                >
                  <option value="">{t("pageSpeedUi.chooseSnapshot")}</option>
                  {history
                    .filter((item) => item.id !== latestSnapshot?.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {new Date(item.capturedAt).toLocaleString()} ·{" "}
                        {item.strategy} ·{" "}
                        {item.pageSpeed ? t("pageSpeedUi.lab") : ""}
                        {item.pageSpeed && item.crux ? " + " : ""}
                        {item.crux ? t("pageSpeedUi.field") : ""}
                      </option>
                    ))}
                </select>
              </label>
              {latestSnapshot && (
                <span className="text-[11px] text-slate-500">
                  {t("pageSpeedUi.latest")}:{" "}
                  {new Date(latestSnapshot.capturedAt).toLocaleString()} ·{" "}
                  {latestSnapshot.url}
                </span>
              )}
            </div>
            {comparison && (
              <div className="space-y-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-xs font-semibold text-sky-200">
                    {t("pageSpeedUi.comparisonTitle")}
                  </h3>
                  <span className="text-[10px] text-slate-500">
                    {t("pageSpeedUi.comparisonMeta", {
                      baseline: new Date(
                        comparison.baseline.capturedAt,
                      ).toLocaleString(),
                      current: new Date(
                        comparison.current.capturedAt,
                      ).toLocaleString(),
                    })}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {comparison.categoryDeltas.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-md border border-slate-800 bg-slate-950/50 p-2"
                    >
                      <span className="block text-[10px] text-slate-500">
                        {t(`pageSpeedUi.categories.${item.key}`)}
                      </span>
                      <span
                        className={`font-mono text-sm ${item.delta !== null && item.delta < 0 ? "text-rose-300" : "text-emerald-300"}`}
                      >
                        {formatDelta(
                          item.delta,
                          ` ${t("pageSpeedUi.pointsUnit")}`,
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {comparison.metricDeltas
                    .filter(
                      (item) => item.baseline !== null || item.current !== null,
                    )
                    .map((item) => (
                      <div
                        key={item.id}
                        className="rounded-md border border-slate-800 bg-slate-950/50 p-2"
                      >
                        <span className="block text-[10px] text-slate-500">
                          {t(`pageSpeedUi.metricShort.${item.id}`)}
                        </span>
                        <span className="font-mono text-xs text-slate-200">
                          {formatDelta(item.delta, ` ${t("pageSpeedUi.ms")}`)}
                        </span>
                        <span className="ml-1 text-[10px] text-slate-600">
                          {t("pageSpeedUi.lowerBetter")}
                        </span>
                      </div>
                    ))}
                  {comparison.cruxDeltas
                    .filter(
                      (item) => item.baseline !== null || item.current !== null,
                    )
                    .map((item) => (
                      <div
                        key={`crux-${item.id}`}
                        className="rounded-md border border-slate-800 bg-slate-950/50 p-2"
                      >
                        <span className="block text-[10px] text-slate-500">
                          {t("uiUnits.crux")} {t(`pageSpeedUi.cruxShort.${item.id}`)}
                        </span>
                        <span className="font-mono text-xs text-slate-200">
                          {formatDelta(
                            item.delta,
                            item.id.includes("layout")
                              ? ""
                              : ` ${t("pageSpeedUi.ms")}`,
                          )}
                        </span>
                        <span className="ml-1 text-[10px] text-slate-600">
                          {t("uiUnits.percentile75")}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full min-w-[720px] text-left text-[11px]">
                <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">{t("pageSpeedUi.time")}</th>
                    <th className="px-3 py-2">{t("pageSpeedUi.url")}</th>
                    <th className="px-3 py-2">{t("pageSpeedUi.scope")}</th>
                    <th className="px-3 py-2">
                      {t("pageSpeedUi.categories.performance")}
                    </th>
                    <th className="px-3 py-2">{t("pageSpeedUi.source")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                        {new Date(item.capturedAt).toLocaleString()}
                      </td>
                      <td
                        className="max-w-[20rem] truncate px-3 py-2 text-slate-300"
                        title={item.url}
                      >
                        {item.url}
                      </td>
                      <td className="px-3 py-2 text-slate-400">
                        {item.strategy} / {item.formFactor} / {item.scope}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-200">
                        {item.pageSpeed?.categories.performance ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {item.pageSpeed ? t("pageSpeedUi.pageSpeed") : ""}
                        {item.pageSpeed && item.crux ? " + " : ""}
                        {item.crux ? t("pageSpeedUi.cruxPrefix") : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {psiReport && (
        <section
          className="space-y-4"
          aria-label={t("pageSpeedUi.psiResultsAria")}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-white">
              {t("pageSpeedUi.labTitle")}
            </h2>
            <span className="text-xs text-slate-500">
              {psiReport.source} · {psiReport.strategy} ·{" "}
              {psiReport.fetchedAt || t("pageSpeedUi.apiTimeUnavailable")}
              {psiReport.lighthouseVersion
                ? ` · Lighthouse ${psiReport.lighthouseVersion}`
                : ""}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                ["performance", "performance"],
                ["accessibility", "accessibility"],
                ["bestPractices", "bestPractices"],
                ["seo", "seo"],
              ] as const
            ).map(([key, label]) => {
              const score = psiReport.categories[key];
              return (
                <article
                  key={key}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                >
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">
                      {t(`pageSpeedUi.categories.${label}`)}
                    </span>
                    <span className="font-mono text-xl font-bold text-white">
                      {score === null ? "—" : score}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full ${scoreColor(score)}`}
                      style={{ width: `${score ?? 0}%` }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PSI_METRICS.map(([id, label]) => {
              const metric = psiReport.metrics[id];
              return (
                <article
                  key={id}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
                >
                  <h3 className="text-xs text-slate-400">
                    {t(`pageSpeedUi.metrics.${label}`)}
                  </h3>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {metric?.displayValue || t("pageSpeedUi.noData")}
                  </p>
                  {metric?.score !== null && metric?.score !== undefined && (
                    <span className="text-[11px] text-slate-500">
                      {t("pageSpeedUi.lighthouseScore")}:{" "}
                      {Math.round(metric.score * 100)}%
                    </span>
                  )}
                </article>
              );
            })}
          </div>
          {psiReport.opportunities.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-white">
                {t("pageSpeedUi.opportunities")}
              </h3>
              <div className="space-y-2">
                {psiReport.opportunities.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-sm text-slate-200">
                      <span>{item.title}</span>
                      <span className="text-xs text-amber-300">
                        {item.displayValue ||
                          (item.score === null
                            ? t("pageSpeedUi.diagnostic")
                            : `${Math.round(item.score * 100)}%`)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {renderLighthouseDescription(item.description)}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}
          <section
            className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50"
            aria-label={t("pageSpeedUi.touchAuditAria")}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">
                {t("pageSpeedUi.touchAuditTitle")}
              </h3>
              <span className="text-[11px] text-slate-500">
                {psiReport.strategy.toUpperCase()} · {t("pageSpeedUi.labData")}{" "}
                ·{" "}
                {psiReport.lighthouseVersion
                  ? `Lighthouse ${psiReport.lighthouseVersion}`
                  : t("pageSpeedUi.versionUnavailable")}
              </span>
            </div>
            {!psiReport.touchTargetAudit ? (
              <p className="p-4 text-xs leading-5 text-amber-200">
                {t("pageSpeedUi.noTouchAudit")}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${psiReport.touchTargetAudit.score === 1 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : psiReport.touchTargetAudit.score === 0 ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}
                  >
                    {psiReport.touchTargetAudit.score === 1
                      ? t("pageSpeedUi.passed")
                      : psiReport.touchTargetAudit.score === 0
                        ? t("pageSpeedUi.needsImprovement")
                        : t("pageSpeedUi.noBinaryVerdict", {
                            mode:
                              psiReport.touchTargetAudit.scoreDisplayMode ||
                              t("pageSpeedUi.scoreUnavailable"),
                          })}
                  </span>
                  <span className="text-sm text-slate-200">
                    {psiReport.touchTargetAudit.displayValue ||
                      psiReport.touchTargetAudit.title}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {t("pageSpeedUi.evidenceCount", {
                      count: psiReport.touchTargetAudit.evidenceCount,
                    })}
                  </span>
                </div>
                <p className="px-4 pb-3 text-xs leading-5 text-slate-400">
                  {renderLighthouseDescription(psiReport.touchTargetAudit.description)}
                </p>
                {psiReport.strategy !== "mobile" && (
                  <p className="mx-4 mb-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-200">
                    {t("pageSpeedUi.desktopTouchNotice")}
                  </p>
                )}
                {psiReport.touchTargetAudit.evidence.length > 0 && (
                  <div className="overflow-x-auto border-t border-slate-800">
                    <table className="w-full min-w-[720px] text-left text-xs">
                      <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">
                            {t("pageSpeedUi.element")}
                          </th>
                          <th className="px-4 py-2.5">
                            {t("pageSpeedUi.targetSize")}
                          </th>
                          <th className="px-4 py-2.5">
                            {t("pageSpeedUi.lighthouseEvidence")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {psiReport.touchTargetAudit.evidence.map(
                          (item, index) => (
                            <tr
                              key={`${item.selector || item.label || "target"}-${index}`}
                            >
                              <td className="max-w-[22rem] break-words px-4 py-3 text-slate-200">
                                {item.label ||
                                  item.selector ||
                                  t("pageSpeedUi.targetNumber", {
                                    count: index + 1,
                                  })}
                                <span className="mt-1 block break-all font-mono text-[10px] text-slate-500">
                                  {item.selector}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-300">
                                {item.target ||
                                  (item.targetSize
                                    ? JSON.stringify(item.targetSize)
                                    : "—")}
                                <span className="mt-1 block text-[10px] text-slate-500">
                                  {item.boundingRect
                                    ? JSON.stringify(item.boundingRect)
                                    : ""}
                                </span>
                              </td>
                              <td className="max-w-[28rem] break-words px-4 py-3 text-slate-400">
                                {item.failureSummary ||
                                  item.explanation ||
                                  item.snippet ||
                                  t("pageSpeedUi.lighthouseFallback")}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                    {psiReport.touchTargetAudit.evidenceTruncated && (
                      <p className="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-500">
                        {t("pageSpeedUi.firstEvidence", {
                          count: psiReport.touchTargetAudit.evidenceCount,
                        })}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
          <section
            className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
            aria-label={t("pageSpeedUi.imageAuditAria")}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">
                {t("pageSpeedUi.imageAuditTitle")}
              </h3>
              <span className="text-[11px] text-slate-500">
                {t("pageSpeedUi.imageAuditDescription")}
              </span>
            </div>
            {(psiReport.imageOptimizationAudits?.length ?? 0) === 0 ? (
              <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs leading-5 text-amber-200">
                {t("pageSpeedUi.noImageAudit")}
              </p>
            ) : (
              <div className="space-y-2">
                {psiReport.imageOptimizationAudits?.map((audit) => (
                  <article
                    key={audit.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-medium text-slate-100">
                        {audit.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {audit.score === 0 ? (
                          <span className="rounded-full bg-rose-500/10 px-2 py-1 text-rose-300">
                            {t("pageSpeedUi.problemDetected")}
                          </span>
                        ) : audit.score === 1 ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">
                            {t("pageSpeedUi.passed")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">
                            {t("pageSpeedUi.noVerdict", {
                              mode:
                                audit.scoreDisplayMode ||
                                t("pageSpeedUi.scoreUnavailable"),
                            })}
                          </span>
                        )}
                        <span className="text-slate-400">
                          {audit.displayValue || t("pageSpeedUi.noApiSummary")}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {renderLighthouseDescription(audit.description)}
                    </p>
                    {audit.overallSavingsBytes !== null && (
                      <p className="mt-2 text-xs text-amber-200">
                        {t("pageSpeedUi.estimatedSavings", {
                          value: formatBytes(audit.overallSavingsBytes),
                        })}
                      </p>
                    )}
                    {audit.evidence.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {audit.evidence.map((item, index) => (
                          <div
                            key={`${item.url || item.selector || audit.id}-${index}`}
                            className="grid gap-1 rounded-md bg-slate-900/70 p-2 text-[11px] sm:grid-cols-[minmax(0,1fr)_8rem_8rem]"
                          >
                            <div className="min-w-0 break-all text-slate-300">
                              {item.url ||
                                item.label ||
                                item.selector ||
                                t("pageSpeedUi.elementNumber", {
                                  count: index + 1,
                                })}
                              <span className="mt-0.5 block font-mono text-[10px] text-slate-500">
                                {item.selector}
                              </span>
                            </div>
                            <span className="text-slate-400">
                              {t("pageSpeedUi.transfer")}:{" "}
                              {formatBytes(item.totalBytes) || "—"}
                            </span>
                            <span className="text-amber-200">
                              {t("pageSpeedUi.potential")}:{" "}
                              {formatBytes(item.wastedBytes) || "—"}
                              {item.wastedPercent === null
                                ? ""
                                : ` (${item.wastedPercent.toFixed(1)}%)`}
                            </span>
                          </div>
                        ))}
                        {audit.evidenceTruncated && (
                          <p className="text-[10px] text-slate-500">
                            {t("pageSpeedUi.firstElements", {
                              count: audit.evidenceCount,
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
          {psiReport.fieldExperience && (
            <p className="text-xs text-slate-500">
              {t("pageSpeedUi.fieldIncluded", {
                category: String(
                  psiReport.fieldExperience["overall_category"] ||
                    t("pageSpeedUi.noFieldData"),
                ),
              })}
            </p>
          )}
        </section>
      )}

      {session.crux && (
        <section
          className="space-y-4"
          aria-label={t("pageSpeedUi.cruxResultsAria")}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-white">
                {t("pageSpeedUi.fieldTitle")}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {session.crux.source} · {session.crux.scope} ·{" "}
                {session.crux.formFactor} · {t("pageSpeedUi.fetchedAt")}{" "}
                {new Date(session.crux.fetchedAt).toLocaleString()}
              </p>
            </div>
            <span className="text-xs text-slate-400">
              {collectionPeriod ? `${t("pageSpeedUi.window")}: ${collectionPeriod}` : t("pageSpeedUi.apiCollectionPeriod")}
            </span>
          </div>
          {cruxMetrics ? (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{t("pageSpeedUi.metric")}</th>
                    <th className="px-4 py-3">
                      {t("pageSpeedUi.percentile75")}
                    </th>
                    <th className="px-4 py-3">{t("pageSpeedUi.apiRating")}</th>
                    <th className="px-4 py-3">
                      {t("pageSpeedUi.populationShares")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/60">
                  {Object.entries(cruxMetrics).map(([key, metric]) => {
                    const histogram = Array.isArray(metric.histogram)
                      ? (metric.histogram)
                      : [];
                    return (
                      <tr key={key}>
                        <td className="px-4 py-3 font-medium text-slate-200">
                          {t(`pageSpeedUi.cruxMetrics.${key}`)}
                        </td>
                        <td className="px-4 py-3 font-mono text-white">
                          {formatCruxValue({ ...metric, metric: key }, t)}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {cruxCategory({ ...metric, metric: key }, t)}
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="flex h-2 min-w-40 overflow-hidden rounded-full bg-slate-800"
                            title={t("pageSpeedUi.populationHistogram", {
                              values: histogram
                                .map(
                                  (bin) =>
                                    `${Math.round((bin.density || 0) * 100)}%`,
                                )
                                .join(" / "),
                            })}
                          >
                            {histogram.map((bin, index) => (
                              <span
                                key={index}
                                style={{
                                  width: `${Math.max(0, (bin.density || 0) * 100)}%`,
                                }}
                                className={
                                  index === 0
                                    ? "bg-emerald-400"
                                    : index === histogram.length - 1
                                      ? "bg-rose-400"
                                      : "bg-amber-400"
                                }
                              />
                            ))}
                          </div>
                          <span className="mt-1 block text-[10px] text-slate-500">
                            {histogram
                              .map(
                                (bin) => `${(bin.density * 100).toFixed(0)}%`,
                              )
                              .join(" / ") || t("pageSpeedUi.noHistogram")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p
              role="alert"
              className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200"
            >
              {t("pageSpeedUi.noCruxMetrics")}
            </p>
          )}
        </section>
      )}
    </div>
  );
};
