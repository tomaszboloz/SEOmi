import React from "react";
import { useTranslation } from "react-i18next";
import { Info, Rss } from "lucide-react";
import { PageAuditData } from "@/types";
import { useAuditStore } from "@/stores/auditStore";
import { ProblemsOnlyNotice } from "./ProblemsOnlyNotice";
import { getAmpProblems } from "@/services/auditProblems";
import { AmpFindings } from "./AmpFindings";

interface AmpAuditViewProps {
  audit: PageAuditData;
}

export const AmpAuditView: React.FC<AmpAuditViewProps> = ({ audit }) => {
  const { t } = useTranslation();
  const showOnlyProblems = useAuditStore((state) => state.showOnlyProblems);
  const report = audit.amp;
  const findings = report?.findings ?? [];
  const problems = getAmpProblems(audit);

  if (showOnlyProblems) {
    if (!report)
      return (
        <div className="mx-auto max-w-5xl p-4 md:p-6">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-100">
            {t("ampUi.legacyReportMissing")}
          </div>
        </div>
      );
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                {t("ampUi.detection")}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-100">
                {report.is_amp_document
                  ? t("ampUi.documentDeclares")
                  : t("ampUi.alternateUrl")}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                {t("ampUi.ruleScope")}
              </div>
              <div className="mt-1 text-sm font-semibold text-amber-200">
                {t("ampUi.partialRules")}
              </div>
            </div>
          </div>

          {report.canonical_url && (
            <div className="break-all rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs">
              <span className="mr-2 font-semibold text-slate-400">
                {t("ampUi.canonical")}:
              </span>
              <span className="font-mono text-slate-200">
                {report.canonical_url}
              </span>
            </div>
          )}

          {report.amphtml_urls.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-3 text-xs font-semibold text-slate-200">
                {t("ampUi.declaredAmpHtml")}
              </h3>
              <ul className="space-y-2">
                {report.amphtml_urls.map((url) => (
                  <li
                    key={url}
                    className="break-all font-mono text-xs text-slate-300"
                  >
                    {url}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AmpFindings findings={findings} />

          {report.unchecked.length > 0 && (
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-sky-100">
                <Info className="h-4 w-4" aria-hidden="true" />
                {t("ampUi.outOfScope")}
              </h3>
              <ul className="list-inside list-disc space-y-1 text-xs leading-5 text-sky-100/75">
                {report.unchecked.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
};
