import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import type { PageAuditData } from "@/types";
import {
  downloadAuditCsv,
  downloadAuditHtml,
  downloadAuditJson,
  downloadAuditPdf,
} from "@/services/export";
import { ContextHelp } from "@/components/ContextHelp";

interface OverviewExportBarProps {
  audit: PageAuditData;
}

export const OverviewExportBar: React.FC<OverviewExportBarProps> = ({ audit }) => {
  const { t } = useTranslation();
  const [pdfError, setPdfError] = useState<string | null>(null);

  const exportPdf = async () => {
    setPdfError(null);
    try {
      await downloadAuditPdf(audit);
    } catch (error) {
      setPdfError(
        error instanceof Error
          ? error.message
          : t("legacyUi.overview.pdfError"),
      );
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2.5">
        <span className="text-xs text-slate-400">
          {t("legacyUi.overview.exportDescription")}
        </span>
        <div className="flex gap-2">
          <ContextHelp id="overview-export-help" label={t("overview.exportHelp")}>
            {t("overview.exportHelp")}
          </ContextHelp>
          <button
            onClick={() => downloadAuditJson(audit)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" /> {t("overview.exportJson")}
          </button>
          <button
            onClick={() => downloadAuditCsv(audit)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            <Download className="h-3.5 w-3.5" /> {t("overview.exportCsv")}
          </button>
          <button
            onClick={() => downloadAuditHtml(audit)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/35 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/20"
          >
            <Download className="h-3.5 w-3.5" /> {t("overview.exportHtml")}
          </button>
          <button
            onClick={() => void exportPdf()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/20"
          >
            <Download className="h-3.5 w-3.5" /> {t("overview.exportPdf")}
          </button>
        </div>
      </div>
      {pdfError && (
        <p className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
          {pdfError}
        </p>
      )}
    </>
  );
};
