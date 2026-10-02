import React from "react";
import { useTranslation } from "react-i18next";
import { Clock3, Trash2 } from "lucide-react";
import { PageSpeedSnapshot, clearPageSpeedSnapshots, pageSpeedHistoryCsv } from "@/services/pagespeedHistory";
import { downloadText } from "@/services/export";
import { PageSpeedHistoryCharts } from "./PageSpeedHistoryCharts";
import { PageSpeedHistoryComparison } from "./PageSpeedHistoryComparison";

interface Props {
  history: PageSpeedSnapshot[];
  setHistory: (history: PageSpeedSnapshot[]) => void;
  compareId: string;
  setCompareId: (id: string) => void;
  activeProjectId: string | null;
  latestSnapshot: PageSpeedSnapshot | null;
  chronologicalHistory: PageSpeedSnapshot[];
  comparison: any | null;
}

export const PageSpeedHistory: React.FC<Props> = ({
  history, setHistory, compareId, setCompareId, activeProjectId, latestSnapshot, chronologicalHistory, comparison
}) => {
  const { t } = useTranslation();
  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5" aria-label={t("pageSpeedUi.historyAria")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-sky-300" />
            <h2 className="text-sm font-semibold text-white">{t("pageSpeedUi.historyTitle")}</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{t("pageSpeedUi.historyDescription")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => downloadText(`seomi-pagespeed-history-${activeProjectId || "project"}.csv`, pageSpeedHistoryCsv(history), "text/csv")} disabled={history.length === 0} className="rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">{t("pageSpeedUi.exportCsv")}</button>
          <button type="button" onClick={() => { if (window.confirm(t("pageSpeedUi.clearConfirm"))) { clearPageSpeedSnapshots(activeProjectId); setHistory([]); setCompareId(""); } }} disabled={history.length === 0} className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 px-2.5 py-1.5 text-[11px] text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />{t("pageSpeedUi.clearHistory")}</button>
        </div>
      </div>
      {history.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-500">{t("pageSpeedUi.noSnapshots")}</p>
      ) : (
        <>
          <PageSpeedHistoryCharts chronologicalHistory={chronologicalHistory} latestSnapshot={latestSnapshot} />
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <label className="grid min-w-64 gap-1 text-[11px] text-slate-400">{t("pageSpeedUi.baselineLabel")}
              <select aria-label={t("pageSpeedUi.baselineAria")} value={compareId} onChange={(e) => setCompareId(e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-200">
                <option value="">{t("pageSpeedUi.chooseSnapshot")}</option>
                {history.filter((item) => item.id !== latestSnapshot?.id).map((item) => (
                  <option key={item.id} value={item.id}>{new Date(item.capturedAt).toLocaleString()} · {item.strategy} · {item.pageSpeed ? t("pageSpeedUi.lab") : ""}{item.pageSpeed && item.crux ? " + " : ""}{item.crux ? t("pageSpeedUi.field") : ""}</option>
                ))}
              </select>
            </label>
            {latestSnapshot && <span className="text-[11px] text-slate-500">{t("pageSpeedUi.latest")}: {new Date(latestSnapshot.capturedAt).toLocaleString()} · {latestSnapshot.url}</span>}
          </div>
          <PageSpeedHistoryComparison comparison={comparison} />
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[720px] text-left text-[11px]">
              <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wide text-slate-500">
                <tr><th className="px-3 py-2">{t("pageSpeedUi.time")}</th><th className="px-3 py-2">{t("pageSpeedUi.url")}</th><th className="px-3 py-2">{t("pageSpeedUi.scope")}</th><th className="px-3 py-2">{t("pageSpeedUi.categories.performance")}</th><th className="px-3 py-2">{t("pageSpeedUi.source")}</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {history.map((item) => (
                  <tr key={item.id}><td className="whitespace-nowrap px-3 py-2 text-slate-400">{new Date(item.capturedAt).toLocaleString()}</td><td className="max-w-[20rem] truncate px-3 py-2 text-slate-300" title={item.url}>{item.url}</td><td className="px-3 py-2 text-slate-400">{item.strategy} / {item.formFactor} / {item.scope}</td><td className="px-3 py-2 font-mono text-slate-200">{item.pageSpeed?.categories.performance ?? "—"}</td><td className="px-3 py-2 text-slate-500">{item.pageSpeed ? t("pageSpeedUi.pageSpeed") : ""}{item.pageSpeed && item.crux ? " + " : ""}{item.crux ? t("pageSpeedUi.cruxPrefix") : ""}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};
