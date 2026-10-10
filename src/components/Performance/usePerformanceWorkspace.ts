import { useEffect, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useProjectStore } from '@/stores/projectStore';
import { runPageSpeedInsights, queryCrux } from '@/services/pagespeed';
import { createPageSpeedSnapshot, readPageSpeedSnapshots, savePageSpeedSnapshot, type PageSpeedSnapshot } from '@/services/pagespeedHistory';
import { writeJsonStorage } from '@/services/storage';
import { parseCruxReport, parsePageSpeedReport } from '@/services/performanceContracts';
import { loadSession, storageKey, type PerformanceSession } from './performanceSession';
import { monitorPageSpeedSnapshots } from '@/services/monitoringAlerts';

export interface PerformanceDependencies {
  runPsi?: typeof runPageSpeedInsights;
  runCrux?: typeof queryCrux;
  activeProjectId?: () => string | null;
}

export const usePerformanceWorkspace = (
  activeProjectId: string | null,
  defaultUrl: string,
  t: TFunction,
  dependencies: PerformanceDependencies = {},
) => {
  const [session, setSession] = useState<PerformanceSession>(() =>
    loadSession(activeProjectId, defaultUrl),
  );
  const [isRunningPsi, setIsRunningPsi] = useState(false);
  const [isRunningCrux, setIsRunningCrux] = useState(false);
  const [psiError, setPsiError] = useState<string | null>(null);
  const [cruxError, setCruxError] = useState<string | null>(null);
  const psiRequestToken = useRef(0);
  const cruxRequestToken = useRef(0);
  const [history, setHistory] = useState<PageSpeedSnapshot[]>(() =>
    readPageSpeedSnapshots(activeProjectId),
  );
  const [compareId, setCompareId] = useState("");

  useEffect(() => {
    setSession(loadSession(activeProjectId, defaultUrl));
    setHistory(readPageSpeedSnapshots(activeProjectId));
    setCompareId("");
    setIsRunningPsi(false);
    setIsRunningCrux(false);
    setPsiError(null);
    setCruxError(null);
    psiRequestToken.current += 1;
    cruxRequestToken.current += 1;
  }, [activeProjectId, defaultUrl]);

  const updateSession = (patch: Partial<PerformanceSession>) => {
    const invalidatesPsi = "url" in patch || "strategy" in patch;
    const invalidatesCrux = "url" in patch || "formFactor" in patch || "scope" in patch;
    if (invalidatesPsi) {
      psiRequestToken.current += 1;
      setIsRunningPsi(false);
    }
    if (invalidatesCrux) {
      cruxRequestToken.current += 1;
      setIsRunningCrux(false);
    }
    setSession((current) => {
      const next = { ...current, ...patch };
      if (activeProjectId) {
        writeJsonStorage(storageKey(activeProjectId), next);
      }
      return next;
    });
  };

  const recordSnapshot = (
    patch: Pick<PerformanceSession, "pageSpeed" | "crux">,
  ) => {
    if (
      !activeProjectId ||
      !session.url.trim() ||
      (!patch.pageSpeed && !patch.crux)
    )
      return;
    const snapshot = createPageSpeedSnapshot({
      url: session.url,
      strategy: session.strategy,
      formFactor: session.formFactor,
      scope: session.scope,
      pageSpeed: patch.pageSpeed,
      crux: patch.crux,
    });
    if (history[0]) void monitorPageSpeedSnapshots(activeProjectId, history[0], snapshot);
    setHistory((current) => savePageSpeedSnapshot(activeProjectId, snapshot, current));
  };

  const runPsi = async () => {
    if (!session.url.trim()) return setPsiError(t("pageSpeedUi.urlRequired"));
    const projectId = activeProjectId;
    const requestToken = ++psiRequestToken.current;
    setIsRunningPsi(true);
    setPsiError(null);
    try {
      const pageSpeed = parsePageSpeedReport(await (dependencies.runPsi ?? runPageSpeedInsights)(
        session.url,
        session.strategy,
      ));
      if (!pageSpeed) throw new Error(t("pageSpeedUi.psiError"));
      if ((dependencies.activeProjectId ?? (() => useProjectStore.getState().activeProjectId))() === projectId && psiRequestToken.current === requestToken) {
        updateSession({ pageSpeed });
        recordSnapshot({ pageSpeed, crux: session.crux });
      }
    } catch (error) {
      if ((dependencies.activeProjectId ?? (() => useProjectStore.getState().activeProjectId))() === projectId && psiRequestToken.current === requestToken) {
        setPsiError(
          error instanceof Error ? error.message : t("pageSpeedUi.psiError"),
        );
      }
    } finally {
      if ((dependencies.activeProjectId ?? (() => useProjectStore.getState().activeProjectId))() === projectId && psiRequestToken.current === requestToken) setIsRunningPsi(false);
    }
  };

  const runCrux = async () => {
    if (!session.url.trim()) return setCruxError(t("pageSpeedUi.urlRequired"));
    const projectId = activeProjectId;
    const requestToken = ++cruxRequestToken.current;
    setIsRunningCrux(true);
    setCruxError(null);
    try {
      const crux = parseCruxReport(await (dependencies.runCrux ?? queryCrux)(
        session.url,
        session.formFactor,
        session.scope,
      ));
      if (!crux) throw new Error(t("pageSpeedUi.cruxError"));
      if ((dependencies.activeProjectId ?? (() => useProjectStore.getState().activeProjectId))() === projectId && cruxRequestToken.current === requestToken) {
        updateSession({ crux });
        recordSnapshot({ pageSpeed: session.pageSpeed, crux });
      }
    } catch (error) {
      if ((dependencies.activeProjectId ?? (() => useProjectStore.getState().activeProjectId))() === projectId && cruxRequestToken.current === requestToken) {
        const message = error instanceof Error ? error.message : String(error);
        setCruxError(message.includes("CRUX_NOT_ENOUGH_DATA")
          ? t("pageSpeedUi.cruxNotEnoughData", "Not enough real user data is available for this URL or origin.")
          : message || t("pageSpeedUi.cruxError"));
      }
    } finally {
      if ((dependencies.activeProjectId ?? (() => useProjectStore.getState().activeProjectId))() === projectId && cruxRequestToken.current === requestToken) setIsRunningCrux(false);
    }
  };

  return { session, updateSession, isRunningPsi, isRunningCrux, psiError, cruxError, history, setHistory, compareId, setCompareId, runPsi, runCrux };
};
