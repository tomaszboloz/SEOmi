import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import type { PageAuditData } from "@/types";
import { buildLocalAuditChecks } from "@/services/auditChecks";
import { copyText } from "@/services/clipboard";
import { useAuditStore } from "@/stores/auditStore";
import { OverviewCoverageFilters } from "./OverviewCoverageFilters";
import { OverviewCoverageCard } from "./OverviewCoverageCard";
import { OverviewCoveragePagination } from "./OverviewCoveragePagination";

interface OverviewCoverageSectionProps {
  audit: PageAuditData;
}

export const OverviewCoverageSection: React.FC<OverviewCoverageSectionProps> = ({
  audit,
}) => {
  const { t } = useTranslation();
  const showOnlyProblems = useAuditStore((s) => s.showOnlyProblems);
  const [localCheckQuery, setLocalCheckQuery] = useState("");
  const [localCheckStatus, setLocalCheckStatus] = useState<
    "all" | "pass" | "warning" | "error" | "not_applicable"
  >("all");
  const [localCheckCategory, setLocalCheckCategory] = useState("all");
  const [localCheckPage, setLocalCheckPage] = useState(0);
  const [coverageCopyState, setCoverageCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");

  const localChecks = useMemo(() => buildLocalAuditChecks(audit), [audit]);
  const checksByStatus = {
    pass: localChecks.filter((item) => item.status === "pass"),
    warning: localChecks.filter((item) => item.status === "warning"),
    error: localChecks.filter((item) => item.status === "error"),
  };
  const localCheckCategories = useMemo(
    () => Array.from(new Set(localChecks.map((item) => item.category))),
    [localChecks],
  );

  const filteredLocalChecks = useMemo(() => {
    const needle = localCheckQuery.trim().toLocaleLowerCase();
    return localChecks.filter((item) => {
      if (showOnlyProblems && item.status !== "warning" && item.status !== "error") {
        return false;
      }
      if (localCheckStatus !== "all" && item.status !== localCheckStatus) return false;
      if (localCheckCategory !== "all" && item.category !== localCheckCategory) return false;
      if (!needle) return true;
      return `${item.label} ${item.category} ${item.evidence}`.toLocaleLowerCase().includes(needle);
    });
  }, [localCheckCategory, localCheckQuery, localCheckStatus, localChecks, showOnlyProblems]);

  const localCheckPageSize = 24;
  const localCheckPageCount = Math.max(1, Math.ceil(filteredLocalChecks.length / localCheckPageSize));
  const safeLocalCheckPage = Math.min(localCheckPage, localCheckPageCount - 1);
  const visibleCoverageChecks = filteredLocalChecks.slice(
    safeLocalCheckPage * localCheckPageSize,
    (safeLocalCheckPage + 1) * localCheckPageSize,
  );

  const copyCoverage = async () => {
    const text = filteredLocalChecks
      .map((item) => `[${item.status}] ${item.category} · ${item.label}\n${item.evidence}`)
      .join("\n\n");
    const copied = await copyText(text);
    setCoverageCopyState(copied ? "copied" : "failed");
    window.setTimeout(() => setCoverageCopyState("idle"), 1800);
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">
            {t("legacyUi.overview.coverageTitle", { count: localChecks.length })}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {t("legacyUi.overview.coverageDescription")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-medium">
          <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-300">
            {checksByStatus.pass.length} {t("legacyUi.overview.passed")}
          </span>
          <span className="rounded-md bg-amber-500/10 px-2 py-1 text-amber-300">
            {checksByStatus.warning.length} {t("legacyUi.overview.warningCount")}
          </span>
          <span className="rounded-md bg-rose-500/10 px-2 py-1 text-rose-300">
            {checksByStatus.error.length} {t("legacyUi.overview.errorCount")}
          </span>
          <button
            type="button"
            onClick={() => void copyCoverage()}
            disabled={filteredLocalChecks.length === 0}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-slate-300 transition hover:border-emerald-500/50 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t("legacyUi.overview.copyChecks")}
          >
            <Copy className="h-3 w-3" aria-hidden="true" />
            {coverageCopyState === "copied"
              ? t("legacyUi.overview.copied")
              : coverageCopyState === "failed"
                ? t("legacyUi.overview.copyFailed")
                : t("legacyUi.overview.copy")}
          </button>
        </div>
      </div>

      <OverviewCoverageFilters
        localCheckQuery={localCheckQuery}
        setLocalCheckQuery={setLocalCheckQuery}
        localCheckStatus={localCheckStatus}
        setLocalCheckStatus={setLocalCheckStatus}
        localCheckCategory={localCheckCategory}
        setLocalCheckCategory={setLocalCheckCategory}
        localCheckCategories={localCheckCategories}
        resetPage={() => setLocalCheckPage(0)}
      />

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCoverageChecks.map((item) => (
          <OverviewCoverageCard key={item.id} item={item} />
        ))}
      </div>

      {visibleCoverageChecks.length === 0 && (
        <p className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-5 text-center text-xs text-slate-500">
          {t("legacyUi.overview.noMatchingChecks")}
        </p>
      )}

      <OverviewCoveragePagination
        totalResults={filteredLocalChecks.length}
        safePage={safeLocalCheckPage}
        pageCount={localCheckPageCount}
        onPrev={() => setLocalCheckPage((page) => Math.max(0, page - 1))}
        onNext={() => setLocalCheckPage((page) => Math.min(localCheckPageCount - 1, page + 1))}
      />
    </section>
  );
};
