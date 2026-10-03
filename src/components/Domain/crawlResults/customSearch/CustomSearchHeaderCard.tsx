import { FileDown } from "lucide-react";
import type { CrawlRunRecord } from "@/types";

interface CustomSearchHeaderCardProps {
  searchesCount: number;
  currentRun?: CrawlRunRecord;
  onExport: () => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export const CustomSearchHeaderCard = ({
  searchesCount,
  currentRun,
  onExport,
  t,
}: CustomSearchHeaderCardProps) => (
  <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h3 className="text-sm font-semibold text-slate-100">
        {t("crawl.customSearch.previewTitle", { count: searchesCount })}
      </h3>
      <p className="mt-1 text-[11px] text-slate-500">
        {t("crawl.customSearch.previewDescription")}
      </p>
    </div>
    <button
      type="button"
      onClick={onExport}
      disabled={!currentRun}
      className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-emerald-500/30 px-3 text-xs font-medium text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
    >
      <FileDown className="h-3.5 w-3.5" />
      {t("crawl.customSearch.export")}
    </button>
  </div>
);
