import React from "react";
import type { PageAuditData } from "@/types";
import { OverviewExportBar } from "./overview/OverviewExportBar";
import { OverviewScoreGauge } from "./overview/OverviewScoreGauge";
import { OverviewIssuesSummary } from "./overview/OverviewIssuesSummary";
import { OverviewServerCard } from "./overview/OverviewServerCard";
import { OverviewContentCard } from "./overview/OverviewContentCard";
import { OverviewContentAnalysis } from "./overview/OverviewContentAnalysis";
import { OverviewCoverageSection } from "./overview/OverviewCoverageSection";
import { OverviewDataForSeoBar } from "./overview/OverviewDataForSeoBar";
import { OverviewQuickWins } from "./overview/OverviewQuickWins";
import { OverviewIssuesList } from "./overview/OverviewIssuesList";

export interface OverviewProps {
  audit: PageAuditData;
}

export const Overview: React.FC<OverviewProps> = ({ audit }) => {
  const criticalIssues = audit.issues.filter((i) => i.severity === "Critical");
  const warnings = audit.issues.filter((i) => i.severity === "Warning");
  const infoIssues = audit.issues.filter((i) => i.severity === "Info");

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6 animate-in fade-in duration-200">
      <OverviewExportBar audit={audit} />

      {/* Top Banner: Score Gauge & Key Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <OverviewScoreGauge
          audit={audit}
          criticalCount={criticalIssues.length}
        />
        <OverviewIssuesSummary
          criticalIssues={criticalIssues}
          warnings={warnings}
          infoIssues={infoIssues}
          totalIssuesCount={audit.issues.length}
        />
        <OverviewServerCard audit={audit} />
        <OverviewContentCard audit={audit} />
      </div>

      <OverviewContentAnalysis audit={audit} />
      <OverviewCoverageSection audit={audit} />
      <OverviewDataForSeoBar audit={audit} />
      <OverviewQuickWins issuesCount={audit.issues.length} />
      <OverviewIssuesList audit={audit} />
    </div>
  );
};
