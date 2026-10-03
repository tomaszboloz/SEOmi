import React from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { PageAuditData, Issue } from "@/types";
import { localizeAuditIssue } from "@/services/auditIssueLocalization";
import { ShowOnPageButton } from "@/components/Results/ShowOnPageButton";
import {
  accessibilityEvidenceLabelKey,
  accessibilitySelectorForCode,
  issueCategoryTranslationKeys,
} from "./overviewTypes";

interface OverviewIssueItemProps {
  issue: Issue;
  audit: PageAuditData;
}

export const OverviewIssueItem: React.FC<OverviewIssueItemProps> = ({
  issue,
  audit,
}) => {
  const { t } = useTranslation();
  const localizedIssue = localizeAuditIssue(issue, t);
  const isCritical = issue.severity === "Critical";
  const isWarning = issue.severity === "Warning";

  const accessibilityFinding = audit.accessibility?.findings?.find(
    (finding) =>
      finding.code === issue.code || issue.message.includes(finding.code),
  );
  const accessibilityElements = accessibilityFinding?.elements ?? [];
  const evidenceCode = accessibilityFinding?.code ?? issue.code;
  const evidenceSelector = accessibilitySelectorForCode(evidenceCode);
  const evidenceLabel = t(accessibilityEvidenceLabelKey(evidenceCode));

  const Icon = isCritical
    ? AlertCircle
    : isWarning
      ? AlertTriangle
      : CheckCircle2;

  return (
    <div className="p-4 hover:bg-slate-800/30 transition flex items-start space-x-3.5">
      <div
        className={`p-1.5 rounded-md shrink-0 mt-0.5 ${
          isCritical
            ? "bg-rose-500/10 text-rose-400"
            : isWarning
              ? "bg-amber-500/10 text-amber-400"
              : "bg-blue-500/10 text-blue-400"
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-white">
            {localizedIssue.displayMessage}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold uppercase ${
              isCritical
                ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                : isWarning
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  : "bg-blue-500/10 text-blue-400 border border-blue-500/30"
            }`}
          >
            {t(`crawl.ui.severityValues.${issue.severity.toLowerCase()}`)}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            [{t(`auditChecks.categories.${issueCategoryTranslationKeys[issue.category]}`)}]
          </span>
        </div>

        {localizedIssue.displayRecommendation && (
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            <span className="text-slate-300 font-medium">
              {t("legacyUi.overview.action")}
            </span>
            {localizedIssue.displayRecommendation}
          </p>
        )}

        {accessibilityElements.length > 0 && (
          <details className="mt-2 rounded-md border border-slate-700/70 bg-slate-950/40 px-3 py-2">
            <summary className="cursor-pointer text-[11px] font-medium text-emerald-200">
              {t("accessibility.locationSummary", {
                count: accessibilityElements.length,
              })}
            </summary>
            <p className="mt-1 text-[10px] text-slate-500">
              {t("accessibility.locationDescription")}
            </p>
            <div className="mt-2 space-y-2">
              {accessibilityElements.map((element) => (
                <div
                  key={`${element.dom_position}-${element.dom_query}`}
                  className="rounded border border-slate-800 bg-slate-900/70 p-2"
                >
                  <p className="text-[10px] text-slate-400">
                    {t("accessibility.elementPosition", {
                      label: evidenceLabel,
                      position: element.dom_position,
                      order:
                        evidenceCode ===
                          "accessibility-form-controls-unlabeled" ||
                        evidenceCode ===
                          "accessibility-antispam-control-not-text"
                          ? t("accessibility.domOrder")
                          : t("accessibility.selectorOrder"),
                      source: element.line
                        ? t("accessibility.source", {
                            line: element.line,
                            column: element.column ?? 1,
                          })
                        : t("accessibility.sourceUnavailable"),
                    })}
                  </p>
                  <code className="mt-1 block break-all text-[10px] text-emerald-200">
                    {element.dom_query}
                  </code>
                  <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] text-slate-300">
                    {element.html_snippet}
                  </pre>
                  <ShowOnPageButton
                    url={audit.final_url || audit.url}
                    selector={evidenceSelector}
                    domIndex={element.dom_position - 1}
                    label={`${evidenceLabel} #${element.dom_position}`}
                  />
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};
