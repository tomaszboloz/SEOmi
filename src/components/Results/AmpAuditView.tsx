import React from "react";
import { useTranslation } from "react-i18next";
import { Info, Rss } from "lucide-react";
import { PageAuditData } from "@/types";
import { useAuditStore } from "@/stores/auditStore";
import { ProblemsOnlyNotice } from "./ProblemsOnlyNotice";
import { getAmpProblems } from "@/services/auditProblems";
import { AmpDetectionCards } from "./ampAudit/AmpDetectionCards";
import { AmpHtmlUrlsCard } from "./ampAudit/AmpHtmlUrlsCard";
import { AmpFindingsCard } from "./ampAudit/AmpFindingsCard";
import { AmpUncheckedCard } from "./ampAudit/AmpUncheckedCard";

interface AmpAuditViewProps {
  audit: PageAuditData;
}

export const AmpAuditView: React.FC<AmpAuditViewProps> = ({ audit }) => {
  const { t } = useTranslation();
  const showOnlyProblems = useAuditStore((state) => state.showOnlyProblems);
  const report = audit.amp;
  const problems = getAmpProblems(audit);

  if (showOnlyProblems) {
    if (!report) {
      return (
        <div className="mx-auto max-w-5xl p-4 md:p-6">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-100">
            {t("ampUi.legacyReportMissing")}
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-6">
        <ProblemsOnlyNotice problems={problems} subject={t("ampUi.subject")} />
      </div>
    );
  }

  return (
    <section
      className="mx-auto max-w-5xl space-y-5 p-4 md:p-6"
      aria-labelledby="amp-audit-title"
    >
      <header className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <Rss
          className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 id="amp-audit-title" className="text-sm font-bold text-white">
            {t("ampUi.title")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {t("ampUi.description")}
          </p>
        </div>
      </header>

      {!report ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-100">
          {t("ampUi.reportMissing")}
        </div>
      ) : !report.detected ? (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-300">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
            aria-hidden="true"
          />
          {t("ampUi.notDetected")}
        </div>
      ) : (
        <>
          <AmpDetectionCards report={report} t={t} />
          <AmpHtmlUrlsCard urls={report.amphtml_urls} t={t} />
          <AmpFindingsCard findings={report.findings ?? []} t={t} />
          <AmpUncheckedCard unchecked={report.unchecked} t={t} />
        </>
      )}
    </section>
  );
};
