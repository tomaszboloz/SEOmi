import React from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "@/stores/projectStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { comparePageSpeedSnapshots } from "@/services/pagespeedHistory";
import { usePerformanceWorkspace } from "./usePerformanceWorkspace";
import { readCruxMetrics, formatCruxCollectionPeriod } from "./cruxEvidence";

import { PageSpeedConfig } from "./pagespeed/PageSpeedConfig";
import { PageSpeedHistory } from "./pagespeed/PageSpeedHistory";
import { PageSpeedLab } from "./pagespeed/PageSpeedLab";
import { PageSpeedField } from "./pagespeed/PageSpeedField";

export const PageSpeedWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const project = useProjectStore((state) => state.projects.find((item) => item.id === state.activeProjectId));
  const hasApiKey = Boolean(useSettingsStore((state) => state.googleMetricsApiKey));
  
  const {
    session, updateSession, isRunningPsi, isRunningCrux, psiError, cruxError,
    history, setHistory, compareId, setCompareId, runPsi, runCrux
  } = usePerformanceWorkspace(activeProjectId, project?.rootUrl || "", t);

  const cruxMetrics = readCruxMetrics(session.crux?.response);
  const collectionPeriod = formatCruxCollectionPeriod(session.crux?.response);

  const psiReport = session.pageSpeed;
  const chronologicalHistory = [...history].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const latestSnapshot = history[0] || null;
  const baselineSnapshot = history.find((item) => item.id === compareId) || null;
  const comparison = baselineSnapshot && latestSnapshot && baselineSnapshot.id !== latestSnapshot.id
    ? comparePageSpeedSnapshots(baselineSnapshot, latestSnapshot)
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <PageSpeedConfig
        session={session}
        updateSession={updateSession}
        isRunningPsi={isRunningPsi}
        isRunningCrux={isRunningCrux}
        psiError={psiError}
        cruxError={cruxError}
        runPsi={runPsi}
        runCrux={runCrux}
        hasApiKey={hasApiKey}
      />
      <PageSpeedHistory
        history={history}
        setHistory={setHistory}
        compareId={compareId}
        setCompareId={setCompareId}
        activeProjectId={activeProjectId}
        latestSnapshot={latestSnapshot}
        chronologicalHistory={chronologicalHistory}
        comparison={comparison}
      />
      <PageSpeedLab psiReport={psiReport} />
      <PageSpeedField session={session} cruxMetrics={cruxMetrics} collectionPeriod={collectionPeriod} />
    </div>
  );
};
